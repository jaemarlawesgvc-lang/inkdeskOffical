/**
 * lib/stripe/webhook-process.ts
 *
 * Extracted Stripe webhook event processing logic.
 *
 * Shared between:
 *   - POST /api/webhooks/stripe  (live webhook handler)
 *   - POST /api/admin/webhooks/retry  (admin retry of failed events)
 *
 * Each handler function receives a Supabase admin client (service role,
 * RLS bypassed) and the raw Stripe event object.
 */

import type Stripe from 'stripe'
import { getStripe, priceIdToPlan } from '@/lib/stripe/server'
import {
  sendBookingConfirmation,
  sendArtistNotification,
  loadBookingWithArtist,
} from '@/lib/resend/send'
import type { createSupabaseAdminClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminClient = ReturnType<typeof createSupabaseAdminClient>

// ---------------------------------------------------------------------------
// Main dispatcher — processes a single Stripe event
// ---------------------------------------------------------------------------

export async function processStripeEvent(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const stripe = getStripe()

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(supabase, event)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(supabase, event)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(supabase, event)
      break

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(supabase, event)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(supabase, event)
      break

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(supabase, stripe, event)
      break

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(supabase, event)
      break

    default:
      // Unhandled event type — no-op, caller marks as processed
      break
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve supabase user_id from a Stripe customer
// ---------------------------------------------------------------------------

async function resolveUserIdFromCustomer(
  supabase: AdminClient,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Helper: extract subscription fields from a Stripe Subscription object
// ---------------------------------------------------------------------------

function extractSubscriptionFields(sub: Stripe.Subscription) {
  const item = sub.items.data[0]
  const priceId = item?.price?.id ?? ''
  const plan = priceIdToPlan(priceId) ?? 'free'

  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    incomplete: 'cancelled',
    incomplete_expired: 'cancelled',
    unpaid: 'past_due',
    paused: 'cancelled',
  }

  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    plan,
    status: statusMap[sub.status] ?? 'cancelled',
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }
}

// ===========================================================================
// Event handlers
// ===========================================================================

// ── customer.subscription.created ──────────────────────────────────────────

async function handleSubscriptionCreated(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId = sub.metadata.supabase_user_id || (await resolveUserIdFromCustomer(supabase, customerId))

  if (!userId) {
    throw new Error(`No user found for Stripe customer ${customerId}`)
  }

  const fields = extractSubscriptionFields(sub)

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        ...fields,
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`)
  }
}

// ── customer.subscription.updated ──────────────────────────────────────────

async function handleSubscriptionUpdated(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId = sub.metadata.supabase_user_id || (await resolveUserIdFromCustomer(supabase, customerId))

  if (!userId) {
    throw new Error(`No user found for Stripe customer ${customerId}`)
  }

  const fields = extractSubscriptionFields(sub)

  const { error } = await supabase
    .from('subscriptions')
    .update(fields)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`)
  }
}

// ── customer.subscription.deleted ──────────────────────────────────────────

async function handleSubscriptionDeleted(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId = sub.metadata.supabase_user_id || (await resolveUserIdFromCustomer(supabase, customerId))

  if (!userId) {
    throw new Error(`No user found for Stripe customer ${customerId}`)
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      plan: 'free',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`)
  }
}

// ── invoice.payment_succeeded ──────────────────────────────────────────────

async function handleInvoicePaymentSucceeded(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id

  if (!subId) return

  const periodEnd = invoice.lines.data[0]?.period?.end

  if (!periodEnd) return

  const { error } = await supabase
    .from('subscriptions')
    .update({
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subId)

  if (error) {
    throw new Error(`Failed to update subscription period: ${error.message}`)
  }
}

// ── invoice.payment_failed ─────────────────────────────────────────────────

async function handleInvoicePaymentFailed(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  const subId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id

  if (!subId) return

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subId)

  if (error) {
    throw new Error(`Failed to mark subscription past_due: ${error.message}`)
  }
}

// ── payment_intent.succeeded (deposit flow with anti-race) ─────────────────

async function handlePaymentIntentSucceeded(
  supabase: AdminClient,
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const metadata = paymentIntent.metadata

  if (metadata.type !== 'deposit') return

  const bookingId = metadata.booking_id
  const artistId = metadata.artist_id

  if (!bookingId || !artistId) {
    throw new Error('Deposit PaymentIntent missing booking_id or artist_id metadata')
  }

  // ── Step 1: Load the booking ──
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, artist_id, booking_date, booking_time, status, deposit_paid')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    throw new Error(`Booking ${bookingId} not found`)
  }

  // Idempotency: if already deposit_paid, don't re-process
  if (booking.deposit_paid) {
    return
  }

  // ── Step 2: Verify booking hold still exists ──
  const holdQuery = supabase
    .from('booking_holds')
    .select('id')
    .eq('artist_id', artistId)
    .eq('booking_date', booking.booking_date)
    .gt('expires_at', new Date().toISOString())

  if (booking.booking_time) {
    holdQuery.eq('booking_time', booking.booking_time)
  }

  const { data: hold } = await holdQuery.maybeSingle()

  // ── Step 3: Check for conflicting confirmed bookings ──
  const conflictQuery = supabase
    .from('bookings')
    .select('id')
    .eq('artist_id', artistId)
    .eq('booking_date', booking.booking_date)
    .in('status', ['confirmed', 'deposit_paid'])
    .neq('id', bookingId)

  if (booking.booking_time) {
    conflictQuery.eq('booking_time', booking.booking_time)
  }

  const { data: conflicts } = await conflictQuery

  const hasConflict = (conflicts && conflicts.length > 0) || false
  const holdExpired = !hold

  // ── Step 4: If conflict or hold expired → refund ──
  if (hasConflict || holdExpired) {
    const reason = hasConflict
      ? 'A conflicting booking was confirmed for this slot'
      : 'The booking hold expired before payment completed'

    try {
      await stripe.refunds.create({
        payment_intent: paymentIntent.id,
        reason: 'requested_by_customer',
      })
    } catch (refundErr) {
      const msg = refundErr instanceof Error ? refundErr.message : 'Refund failed'
      console.error(`[stripe-webhook] refund failed for PI ${paymentIntent.id}:`, msg)
    }

    await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        stripe_payment_status: 'refunded',
        notes: `Auto-cancelled: ${reason}. PaymentIntent ${paymentIntent.id} refunded.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    const refundBookingData = await loadBookingWithArtist(supabase, bookingId)
    if (refundBookingData) {
      await sendBookingConfirmation(supabase, {
        ...refundBookingData,
        depositPaid: false,
      }).catch((emailErr) => {
        console.error('[stripe-webhook] cancellation email failed:', emailErr instanceof Error ? emailErr.message : emailErr)
      })
    }

    return
  }

  // ── Step 5: Confirm booking, delete hold ──
  const { error: confirmError } = await supabase
    .from('bookings')
    .update({
      status: 'deposit_paid',
      deposit_paid: true,
      stripe_payment_status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (confirmError) {
    throw new Error(`Failed to confirm booking ${bookingId}: ${confirmError.message}`)
  }

  const deleteHoldQuery = supabase
    .from('booking_holds')
    .delete()
    .eq('artist_id', artistId)
    .eq('booking_date', booking.booking_date)

  if (booking.booking_time) {
    deleteHoldQuery.eq('booking_time', booking.booking_time)
  }

  await deleteHoldQuery

  const confirmedBookingData = await loadBookingWithArtist(supabase, bookingId)
  if (confirmedBookingData) {
    await Promise.allSettled([
      sendBookingConfirmation(supabase, confirmedBookingData),
      sendArtistNotification(supabase, confirmedBookingData),
    ])
  }
}

// ── payment_intent.payment_failed ──────────────────────────────────────────

async function handlePaymentIntentFailed(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const metadata = paymentIntent.metadata

  if (metadata.type !== 'deposit') return

  const bookingId = metadata.booking_id
  if (!bookingId) return

  const { error } = await supabase
    .from('bookings')
    .update({
      stripe_payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    throw new Error(`Failed to mark booking ${bookingId} payment failed: ${error.message}`)
  }

  const failedBookingData = await loadBookingWithArtist(supabase, bookingId)
  if (failedBookingData) {
    await sendArtistNotification(supabase, failedBookingData).catch((emailErr) => {
      console.error('[stripe-webhook] payment failure notification failed:', emailErr instanceof Error ? emailErr.message : emailErr)
    })
  }
}
