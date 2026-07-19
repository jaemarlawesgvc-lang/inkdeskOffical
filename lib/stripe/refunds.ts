/**
 * lib/stripe/refunds.ts
 *
 * Centralised deposit/balance refund that correctly unwinds a Connect
 * destination charge — including the onward studio-commission transfer.
 *
 * The charge is a destination charge to the ARTIST, optionally with an
 * `application_fee` (the studio commission) retained by the platform and then
 * transferred onward to the studio. A naive `refunds.create({payment_intent})`
 * would refund the client from the PLATFORM balance while the artist keeps their
 * share and the studio keeps the commission — the platform eats the loss. To
 * unwind fully and fund the refund from the parties that were paid:
 *
 *   1. Reverse the onward studio-commission transfer (pull the commission back
 *      from the studio to the platform), if one was made.
 *   2. Refund the charge with `reverse_transfer: true` (pull the artist's share
 *      back) and `refund_application_fee: true` when a fee was charged.
 *
 * For a still-uncaptured (manual) intent there is nothing to refund — cancel the
 * authorization instead. Never throws; returns a structured outcome.
 */

import { getStripe } from '@/lib/stripe/server'
import type { createSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export type RefundOutcome = 'refunded' | 'released' | 'already' | 'none' | 'failed'

// A retry_count high enough that the commission retry cron's `retry_count <
// MAX_RETRIES` filter can never re-select a row we mark terminal here.
const TERMINAL_RETRY_COUNT = 9999

/**
 * Optimistic CAS re-credit of a gift card's remaining balance. Inlined here
 * (rather than imported from webhook-process) to avoid a module import cycle —
 * webhook-process already imports refundDepositCharge from this file. Never
 * over-credits: the caller gates each credit on a ledger-row status transition.
 */
async function creditGiftCardCAS(
  db: AdminClient,
  cardId: string,
  amountPence: number,
): Promise<boolean> {
  if (amountPence <= 0) return true

  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: card, error } = await db
      .from('gift_cards')
      .select('remaining_amount_pence, status')
      .eq('id', cardId)
      .maybeSingle()

    if (error || !card) return false
    if (card.status === 'void') return false

    const remaining = Number(card.remaining_amount_pence)
    const newRemaining = remaining + amountPence
    const newStatus = card.status === 'redeemed' ? 'active' : card.status

    const { data: updated } = await db
      .from('gift_cards')
      .update({ remaining_amount_pence: newRemaining, status: newStatus })
      .eq('id', cardId)
      .eq('remaining_amount_pence', remaining)
      .eq('status', card.status)
      .select('id')
      .maybeSingle()

    if (updated) return true
  }

  return false
}

/**
 * Restore gift-card value applied to a refunded PaymentIntent. Gated STRICTLY on
 * the ledger-row status transition (reserved/consumed → refunded): the status is
 * flipped FIRST via a CAS, and only the winner re-credits the card. A second
 * refund call therefore finds no row still in reserved/consumed and re-credits
 * NOTHING. This is the one place over-credit could be introduced, so nothing
 * here credits without first winning the status transition.
 */
async function restoreGiftCardForRefund(
  db: AdminClient,
  paymentIntentId: string,
): Promise<void> {
  const { data: rows, error } = await db
    .from('gift_card_applications')
    .select('id, gift_card_id, amount_pence')
    .eq('payment_intent_id', paymentIntentId)
    .in('status', ['reserved', 'consumed'])

  if (error) {
    console.error('[refunds] failed to load gift card applications:', error.message)
    return
  }

  for (const row of rows ?? []) {
    const { data: claimed } = await db
      .from('gift_card_applications')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .in('status', ['reserved', 'consumed'])
      .select('id')
      .maybeSingle()

    if (!claimed) continue

    const ok = await creditGiftCardCAS(db, row.gift_card_id, Number(row.amount_pence))
    if (!ok) {
      console.error(
        `[refunds] gift card ${row.gift_card_id} could not be re-credited on refund for PI ${paymentIntentId}`,
      )
    }
  }
}

export async function refundDepositCharge(
  db: AdminClient,
  paymentIntentId: string,
): Promise<{ outcome: RefundOutcome; reason: string }> {
  const stripe = getStripe()
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (intent.status === 'requires_capture') {
      await stripe.paymentIntents.cancel(paymentIntentId)
      // The authorization never captured, but a gift-card reservation may still
      // be committed against it — restore it.
      await restoreGiftCardForRefund(db, paymentIntentId)
      return { outcome: 'released', reason: 'authorization_released' }
    }
    if (intent.status === 'canceled') {
      await restoreGiftCardForRefund(db, paymentIntentId)
      return { outcome: 'already', reason: 'already_canceled' }
    }
    if (intent.status !== 'succeeded') {
      return { outcome: 'none', reason: `intent status ${intent.status}` }
    }

    const hasAppFee = (intent.application_fee_amount ?? 0) > 0

    // 1. Reverse the onward studio commission transfer first, so the platform
    //    holds the fee again before it refunds it below. Track whether the
    //    reversal actually succeeded — it gates refund_application_fee in step 2.
    const { data: commissionRow } = await db
      .from('studio_commission_transfers')
      .select('id, stripe_transfer_id, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    let reversalFailed = false

    if (commissionRow?.stripe_transfer_id && commissionRow.status === 'paid') {
      try {
        const reversal = await stripe.transfers.createReversal(
          commissionRow.stripe_transfer_id,
          {},
          { idempotencyKey: `commission_reversal_${paymentIntentId}` },
        )
        await db
          .from('studio_commission_transfers')
          .update({
            status: 'reversed',
            stripe_reversal_id: reversal.id,
            reversed_at: new Date().toISOString(),
          })
          .eq('id', commissionRow.id)
      } catch (revErr) {
        // Continue with the client refund regardless; flag for manual review.
        reversalFailed = true
        console.error(
          '[refunds] studio commission reversal failed:',
          revErr instanceof Error ? revErr.message : revErr,
        )
        await db
          .from('studio_commission_transfers')
          .update({ last_error: revErr instanceof Error ? revErr.message : 'reversal failed' })
          .eq('id', commissionRow.id)
      }
    } else if (commissionRow && commissionRow.status !== 'paid' && commissionRow.status !== 'reversed') {
      // The commission was never forwarded (pending/failed). Mark it terminal so
      // the retry cron can NEVER later forward commission for this refunded
      // booking. 'reversed' is not a status the cron re-selects; the high
      // retry_count is belt-and-braces.
      await db
        .from('studio_commission_transfers')
        .update({
          status: 'reversed',
          retry_count: TERMINAL_RETRY_COUNT,
          last_error: 'booking refunded before commission was forwarded — not forwarding',
          reversed_at: new Date().toISOString(),
        })
        .eq('id', commissionRow.id)
    }

    // 2. Refund the client, pulling funds back from the artist (reverse_transfer)
    //    and refunding the platform-held application fee — but ONLY when the
    //    commission reversal succeeded (or there was no forwarded transfer). If
    //    the reversal FAILED the studio still holds the fee, so refunding it here
    //    would push the platform balance negative.
    const refundAppFee = hasAppFee && !reversalFailed

    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        reverse_transfer: true,
        ...(refundAppFee ? { refund_application_fee: true } : {}),
      },
      { idempotencyKey: `deposit_refund_${paymentIntentId}` },
    )

    // 3. Restore any gift-card value applied to this charge (status-gated, so a
    //    repeat refund call re-credits nothing).
    await restoreGiftCardForRefund(db, paymentIntentId)

    return { outcome: 'refunded', reason: 'refunded' }
  } catch (err) {
    return { outcome: 'failed', reason: err instanceof Error ? err.message : 'refund failed' }
  }
}
