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

import { randomBytes } from 'crypto'
import type Stripe from 'stripe'
import { getStripe, priceIdToPlan } from '@/lib/stripe/server'
import {
  sendBookingConfirmation,
  sendArtistNotification,
  sendDepositReceipt,
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

    case 'account.updated':
      await handleAccountUpdated(supabase, event)
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

  // Upsert (not update) so an out-of-order subscription.updated that arrives
  // before subscription.created still creates the row instead of no-op'ing.
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

  // New payment kinds carry metadata.kind (balance / tip / giftcard). Route
  // them to their own handlers before the legacy deposit path (type:'deposit').
  switch (metadata.kind) {
    case 'balance':
      await handleBalanceSucceeded(supabase, paymentIntent)
      return
    case 'tip':
      await handleTipSucceeded(supabase, paymentIntent)
      return
    case 'giftcard':
      await handleGiftCardSucceeded(supabase, paymentIntent)
      return
    default:
      break
  }

  if (metadata.type !== 'deposit') return

  const bookingId = metadata.booking_id
  const artistId = metadata.artist_id

  if (!bookingId || !artistId) {
    throw new Error('Deposit PaymentIntent missing booking_id or artist_id metadata')
  }

  // ── Step 1: Load the booking ──
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, artist_id, booking_date, booking_time, status, deposit_paid, booking_type')
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
  const isLiveBooking = booking.booking_type === 'live'
  let hold = null

  if (!isLiveBooking) {
    const holdQuery = supabase
      .from('booking_holds')
      .select('id')
      .eq('artist_id', artistId)
      .eq('booking_date', booking.booking_date)
      .gt('expires_at', new Date().toISOString())

    if (booking.booking_time) {
      holdQuery.eq('booking_time', booking.booking_time)
    }

    const { data: holdData } = await holdQuery.maybeSingle()
    hold = holdData
  }

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
  const holdExpired = isLiveBooking ? false : !hold

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
    let cardLast4: string | null = null
    try {
      const fullPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['payment_method'],
      })
      const paymentMethod = fullPaymentIntent.payment_method
      cardLast4 =
        typeof paymentMethod === 'object' && paymentMethod?.card
          ? paymentMethod.card.last4
          : null
    } catch (err) {
      console.error(
        '[stripe-webhook] could not retrieve payment method for receipt:',
        err instanceof Error ? err.message : err,
      )
    }

    await Promise.allSettled([
      sendBookingConfirmation(supabase, confirmedBookingData),
      sendArtistNotification(supabase, confirmedBookingData),
      sendDepositReceipt(supabase, confirmedBookingData, cardLast4),
    ])
  }
}

// ── payment_intent.succeeded → balance (kind:'balance') ────────────────────

async function handleBalanceSucceeded(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const bookingId = paymentIntent.metadata.booking_id
  if (!bookingId) {
    throw new Error('Balance PaymentIntent missing booking_id metadata')
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, balance_paid')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    throw new Error(`Booking ${bookingId} not found for balance payment`)
  }

  // Idempotency: skip if already recorded.
  if (booking.balance_paid) return

  const { error } = await supabase
    .from('bookings')
    .update({
      balance_paid: true,
      balance_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (error) {
    throw new Error(`Failed to mark balance paid for booking ${bookingId}: ${error.message}`)
  }
}

// ── payment_intent.succeeded → tip (kind:'tip') ────────────────────────────

async function handleTipSucceeded(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const artistId = paymentIntent.metadata.artist_id
  if (!artistId) {
    throw new Error('Tip PaymentIntent missing artist_id metadata')
  }

  const bookingId = paymentIntent.metadata.booking_id
  const clientName = paymentIntent.metadata.client_name

  // Idempotency: the unique index on stripe_payment_intent_id makes a repeat
  // delivery a no-op, but check first to avoid a noisy conflict error.
  const { data: existing } = await supabase
    .from('tips')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase.from('tips').insert({
    artist_id: artistId,
    booking_id: bookingId && bookingId.length > 0 ? bookingId : null,
    amount_pence: paymentIntent.amount,
    stripe_payment_intent_id: paymentIntent.id,
    client_name: clientName && clientName.length > 0 ? clientName : null,
  })

  if (error) {
    // Unique-violation from a concurrent delivery is benign.
    if (error.code === '23505') return
    throw new Error(`Failed to record tip for artist ${artistId}: ${error.message}`)
  }
}

// ── payment_intent.succeeded → gift card (kind:'giftcard') ─────────────────

/** Human-friendly, unambiguous gift-card code, e.g. GIFT-4KPT-9WXM-2Q7N. */
function generateGiftCardCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
  const bytes = randomBytes(12)
  let out = ''
  for (let i = 0; i < 12; i++) {
    const byte = bytes[i] ?? 0
    out += alphabet[byte % alphabet.length]
    if (i === 3 || i === 7) out += '-'
  }
  return `GIFT-${out}`
}

async function handleGiftCardSucceeded(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const artistId = paymentIntent.metadata.artist_id
  if (!artistId) {
    throw new Error('Gift card PaymentIntent missing artist_id metadata')
  }

  const purchaserEmail = paymentIntent.metadata.purchaser_email || null
  const recipientEmail = paymentIntent.metadata.recipient_email
  const amountPence = paymentIntent.amount

  // Idempotency: one gift card per PaymentIntent.
  const { data: existing } = await supabase
    .from('gift_cards')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (existing) return

  // Generate a unique code, retrying on the rare UNIQUE collision.
  const MAX_ATTEMPTS = 5
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateGiftCardCode()

    const { error } = await supabase.from('gift_cards').insert({
      artist_id: artistId,
      code,
      initial_amount_pence: amountPence,
      remaining_amount_pence: amountPence,
      purchaser_email: purchaserEmail,
      recipient_email: recipientEmail && recipientEmail.length > 0 ? recipientEmail : null,
      status: 'active',
      stripe_payment_intent_id: paymentIntent.id,
    })

    if (!error) return

    // 23505 = unique_violation. If it collided on stripe_payment_intent_id a
    // concurrent delivery already created the card — done. Otherwise it was the
    // code; regenerate and retry.
    if (error.code === '23505') {
      const { data: nowExists } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle()
      if (nowExists) return
      continue
    }

    throw new Error(`Failed to create gift card for artist ${artistId}: ${error.message}`)
  }

  throw new Error('Failed to generate a unique gift card code after multiple attempts')
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

// ── account.updated (Stripe Connect onboarding progress) ───────────────────

async function handleAccountUpdated(
  supabase: AdminClient,
  event: Stripe.Event,
): Promise<void> {
  const account = event.data.object as Stripe.Account

  // connect-onboarding seeds the status as 'pending'; nothing advances it
  // until Stripe reports the account can take charges. Mirror the value the
  // dashboard UI reads ('verified' = fully connected, otherwise 'pending').
  const status = account.charges_enabled ? 'verified' : 'pending'

  const { error } = await supabase
    .from('artists')
    .update({
      stripe_connect_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_connect_account_id', account.id)

  if (error) {
    throw new Error(
      `Failed to sync Connect status for account ${account.id}: ${error.message}`,
    )
  }
}
