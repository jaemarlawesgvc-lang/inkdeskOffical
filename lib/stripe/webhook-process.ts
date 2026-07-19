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
import { refundDepositCharge } from '@/lib/stripe/refunds'
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

    // Full unwind: pulls the artist's share back, refunds any studio
    // application fee (no commission transfer exists yet at this pre-confirm
    // point, so there is nothing to reverse) and restores any gift-card value.
    const refundResult = await refundDepositCharge(supabase, paymentIntent.id)

    // Only record the booking as refunded/cancelled when the money actually came
    // back (refunded / released / already-unwound). If the refund FAILED, do NOT
    // mark it refunded — leave the booking for retry/manual handling and log
    // loudly, so we never tell the client they were refunded when they were not.
    if (refundResult.outcome === 'failed') {
      console.error(
        `[stripe-webhook] AUTO-REFUND FAILED for PI ${paymentIntent.id} (booking ${bookingId}): ${refundResult.reason}. Booking left un-refunded for manual handling.`,
      )
      return
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

  // ── Gift card: mark the reservation consumed on payment success ──
  // The card was ALREADY decremented at create time and a 'reserved' ledger row
  // was keyed to this PI. Do NOT decrement again — only flip reserved→consumed.
  // Idempotent (status guard); a no-op for non-gift-card PIs. Best-effort — a
  // failure here must not fail the confirmed booking.
  await consumeGiftCardApplication(supabase, paymentIntent.id)

  const deleteHoldQuery = supabase
    .from('booking_holds')
    .delete()
    .eq('artist_id', artistId)
    .eq('booking_date', booking.booking_date)

  if (booking.booking_time) {
    deleteHoldQuery.eq('booking_time', booking.booking_time)
  }

  await deleteHoldQuery

  // ── Studio commission: forward the retained application fee to the studio ──
  // No-op unless this deposit's PI carries studio-commission metadata. Idempotent
  // via the unique payment_intent_id on studio_commission_transfers.
  await processStudioCommissionTransfer(supabase, stripe, paymentIntent, 'deposit')

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

  // A gift card may have been applied against the balance (metadata carries the
  // id + amount) and was already decremented + reserved at create time. Fold the
  // display fields into the same balance_paid=false CAS so they land atomically.
  // The card is NOT decremented here — the reservation is only marked consumed.
  const gcId = paymentIntent.metadata.gift_card_id
  const gcApplied = Number(paymentIntent.metadata.gift_card_applied_pence)
  const hasGiftCard = Boolean(gcId) && Number.isFinite(gcApplied) && gcApplied > 0

  const updateFields: Record<string, unknown> = {
    balance_paid: true,
    balance_payment_intent_id: paymentIntent.id,
    updated_at: new Date().toISOString(),
  }
  if (hasGiftCard) {
    updateFields.gift_card_id = gcId
    updateFields.gift_card_amount_applied_pence = gcApplied
  }

  const { data: claimed, error } = await supabase
    .from('bookings')
    .update(updateFields)
    .eq('id', bookingId)
    .eq('balance_paid', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to mark balance paid for booking ${bookingId}: ${error.message}`)
  }

  // The card was ALREADY decremented at create time (a 'reserved' ledger row is
  // keyed to this PI). Do NOT decrement again — only flip reserved→consumed.
  // Idempotent (status guard) and a no-op for non-gift-card balances.
  await consumeGiftCardApplication(supabase, paymentIntent.id)

  // ── Studio commission: forward the retained application fee to the studio ──
  // Only the delivery that flipped balance_paid runs this; it is itself
  // idempotent via the unique payment_intent_id, and a no-op for solo artists.
  if (claimed) {
    await processStudioCommissionTransfer(supabase, getStripe(), paymentIntent, 'balance')
  }
}

// ── Studio commission transfer (platform → studio connected account) ────────

/**
 * Forward a studio's commission (the application fee the platform retained on a
 * deposit/balance destination charge) to the studio's own connected account,
 * and record it in studio_commission_transfers.
 *
 * No-op unless the PaymentIntent carries studio-commission metadata (studio_id,
 * studio_connect_account_id, studio_commission_pence) — so solo-artist bookings,
 * which never set that metadata, are entirely unaffected.
 *
 * Idempotency: a 'pending' row is inserted first, claiming the PI via the UNIQUE
 * stripe_payment_intent_id. A redelivery / concurrent delivery loses that insert
 * (23505) and returns without creating a duplicate transfer. On transfer success
 * the row is marked 'paid' (with the transfer id); on failure it is marked
 * 'failed' and logged — a retry sweep over 'failed' rows is a follow-up (see the
 * report), not attempted inline.
 */
async function processStudioCommissionTransfer(
  supabase: AdminClient,
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  source: 'deposit' | 'balance',
): Promise<void> {
  const md = paymentIntent.metadata
  const studioId = md.studio_id
  const studioAccountId = md.studio_connect_account_id
  const feePence = Number(md.studio_commission_pence)
  const artistId = md.artist_id
  const bookingId = md.booking_id && md.booking_id.length > 0 ? md.booking_id : null

  // Solo artist / no commission → nothing to forward.
  if (!studioId || !studioAccountId || !artistId || !Number.isFinite(feePence) || feePence <= 0) {
    return
  }

  // Claim the PI with a pending row. UNIQUE(stripe_payment_intent_id) makes a
  // repeat delivery lose this insert — the idempotency gate for the transfer.
  const { error: insertErr } = await supabase
    .from('studio_commission_transfers')
    .insert({
      studio_id: studioId,
      artist_id: artistId,
      booking_id: bookingId,
      source,
      amount_pence: feePence,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
    })

  if (insertErr) {
    // 23505 = already claimed by a prior/concurrent delivery → transfer done/underway.
    if (insertErr.code !== '23505') {
      console.error(
        `[stripe-webhook] failed to record studio commission transfer for PI ${paymentIntent.id}: ${insertErr.message}`,
      )
    }
    return
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: feePence,
        currency: paymentIntent.currency,
        destination: studioAccountId,
        metadata: {
          studio_id: studioId,
          artist_id: artistId,
          booking_id: bookingId ?? '',
          source,
          payment_intent_id: paymentIntent.id,
        },
      },
      { idempotencyKey: `studio_commission_${paymentIntent.id}` },
    )

    const { error: paidErr } = await supabase
      .from('studio_commission_transfers')
      .update({ stripe_transfer_id: transfer.id, status: 'paid' })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (paidErr) {
      console.error(
        `[stripe-webhook] studio commission transfer ${transfer.id} created but row not marked paid for PI ${paymentIntent.id}: ${paidErr.message}`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'transfer failed'
    console.error(
      `[stripe-webhook] studio commission transfer failed for PI ${paymentIntent.id}: ${msg}`,
    )
    await supabase
      .from('studio_commission_transfers')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', paymentIntent.id)
  }
}

// ── Gift card helpers (shared with create-deposit / create-balance) ─────────

/**
 * Optimistic compare-and-swap decrement of a gift card's remaining balance.
 * Returns true when the decrement was applied, false when it could not be
 * (card missing, not active, insufficient balance, or lost every CAS race).
 * When the balance hits zero the card is marked 'redeemed'. Safe to call with
 * appliedPence <= 0 (no-op → true).
 */
export async function decrementGiftCardCAS(
  supabase: AdminClient,
  cardId: string,
  appliedPence: number,
): Promise<boolean> {
  if (appliedPence <= 0) return true

  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('remaining_amount_pence, status')
      .eq('id', cardId)
      .maybeSingle()

    if (error || !card) return false
    if (card.status !== 'active') return false

    const remaining = Number(card.remaining_amount_pence)
    if (remaining < appliedPence) return false

    const newRemaining = remaining - appliedPence
    const newStatus = newRemaining <= 0 ? 'redeemed' : 'active'

    const { data: updated } = await supabase
      .from('gift_cards')
      .update({ remaining_amount_pence: newRemaining, status: newStatus })
      .eq('id', cardId)
      .eq('remaining_amount_pence', remaining)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()

    if (updated) return true
    // CAS lost to a concurrent redemption — retry against the fresh balance.
  }

  return false
}

/**
 * Optimistic compare-and-swap RE-CREDIT of a gift card's remaining balance —
 * the inverse of decrementGiftCardCAS, used to restore value when a reserved
 * charge fails or is refunded. Reactivates a fully-redeemed card. Never
 * over-credits: callers gate the credit on a ledger-row status transition so a
 * redelivery cannot call this twice for the same reservation. Returns true when
 * the credit landed. Safe to call with amountPence <= 0 (no-op → true).
 */
export async function incrementGiftCardCAS(
  supabase: AdminClient,
  cardId: string,
  amountPence: number,
): Promise<boolean> {
  if (amountPence <= 0) return true

  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('remaining_amount_pence, status')
      .eq('id', cardId)
      .maybeSingle()

    if (error || !card) return false
    // A voided card is terminal — never resurrect it.
    if (card.status === 'void') return false

    const remaining = Number(card.remaining_amount_pence)
    const newRemaining = remaining + amountPence
    // Re-crediting a drained ('redeemed') card brings it back to 'active'.
    const newStatus = card.status === 'redeemed' ? 'active' : card.status

    const { data: updated } = await supabase
      .from('gift_cards')
      .update({ remaining_amount_pence: newRemaining, status: newStatus })
      .eq('id', cardId)
      .eq('remaining_amount_pence', remaining)
      .eq('status', card.status)
      .select('id')
      .maybeSingle()

    if (updated) return true
    // CAS lost to a concurrent change — retry against the fresh balance.
  }

  return false
}

/**
 * Mark the gift-card reservation for a succeeded PaymentIntent 'consumed'. The
 * card was already decremented at create time, so this NEVER touches the card
 * balance — it only advances the ledger row's status. Idempotent (only rows
 * still 'reserved' flip) and a no-op for PIs with no gift-card reservation.
 * Best-effort: logs, never throws.
 */
async function consumeGiftCardApplication(
  supabase: AdminClient,
  paymentIntentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('gift_card_applications')
    .update({ status: 'consumed', updated_at: new Date().toISOString() })
    .eq('payment_intent_id', paymentIntentId)
    .eq('status', 'reserved')

  if (error) {
    console.error(
      `[stripe-webhook] failed to mark gift card application consumed for PI ${paymentIntentId}: ${error.message}`,
    )
  }
}

/**
 * Release the gift-card reservation for a FAILED PaymentIntent: re-credit the
 * card and mark the ledger row 'released'. The status transition is claimed
 * FIRST (CAS reserved→released) and only the winner re-credits, so a webhook
 * redelivery can never re-credit twice. Idempotent + best-effort.
 */
async function releaseGiftCardApplication(
  supabase: AdminClient,
  paymentIntentId: string,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from('gift_card_applications')
    .select('id, gift_card_id, amount_pence')
    .eq('payment_intent_id', paymentIntentId)
    .eq('status', 'reserved')

  if (error) {
    console.error(
      `[stripe-webhook] failed to load gift card reservation for PI ${paymentIntentId}: ${error.message}`,
    )
    return
  }

  for (const row of rows ?? []) {
    // Claim the release transition BEFORE re-crediting — this is the no-double-
    // credit gate. A concurrent delivery that loses this update does not credit.
    const { data: claimed } = await supabase
      .from('gift_card_applications')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'reserved')
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    const ok = await incrementGiftCardCAS(supabase, row.gift_card_id, Number(row.amount_pence))
    if (!ok) {
      console.error(
        `[stripe-webhook] gift card ${row.gift_card_id} could not be re-credited on release for PI ${paymentIntentId}`,
      )
    }
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

  const isDeposit = metadata.type === 'deposit'
  const isBalance = metadata.kind === 'balance'
  if (!isDeposit && !isBalance) return

  // Release any gift-card value reserved at create time for this failed PI:
  // re-credit the card and mark the ledger row 'released'. Idempotent and safe
  // for both deposit and balance PIs (no-op when there was no reservation).
  await releaseGiftCardApplication(supabase, paymentIntent.id)

  const bookingId = metadata.booking_id
  if (!bookingId) return

  // Only the deposit flow records a failed payment status + notifies the artist;
  // a failed balance retry leaves balance_paid=false for the client to retry.
  if (!isDeposit) return

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

  // A Connect account id belongs to exactly one owner. If it is a STUDIO's
  // payout account (not an artist's), the update above matched no rows; sync the
  // studios row instead so studio commission payouts unlock once verified. The
  // studios table has no updated_at trigger dependency here — set status only.
  const { error: studioErr } = await supabase
    .from('studios')
    .update({ stripe_connect_status: status })
    .eq('stripe_connect_account_id', account.id)

  if (studioErr) {
    throw new Error(
      `Failed to sync studio Connect status for account ${account.id}: ${studioErr.message}`,
    )
  }
}
