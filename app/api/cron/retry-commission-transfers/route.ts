import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

const MAX_RETRIES = 5
// Studio commission transfers can fail transiently — most often because the
// application fee from a destination charge isn't yet available on the platform
// balance at the same tick the webhook fires. A 'pending' row older than this
// never completed its transfer and is also retried.
const PENDING_STUCK_MINUTES = 10

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()
  const stripe = getStripe()
  const cutoff = new Date(Date.now() - PENDING_STUCK_MINUTES * 60_000).toISOString()

  // Failed transfers, plus 'pending' rows that never completed their transfer.
  const { data: rows, error } = await supabase
    .from('studio_commission_transfers')
    .select(
      `
      id, studio_id, amount_pence, status, retry_count, stripe_payment_intent_id, stripe_transfer_id,
      studios ( stripe_connect_account_id, stripe_connect_status )
    `,
    )
    .or(`status.eq.failed,and(status.eq.pending,created_at.lt.${cutoff})`)
    .lt('retry_count', MAX_RETRIES)
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let retried = 0
  let paid = 0
  let skipped = 0

  for (const row of rows ?? []) {
    // Already has a transfer id → a prior attempt actually succeeded; reconcile.
    if (row.stripe_transfer_id) {
      await supabase.from('studio_commission_transfers').update({ status: 'paid' }).eq('id', row.id)
      paid++
      continue
    }

    const studio = row.studios as unknown as {
      stripe_connect_account_id: string | null
      stripe_connect_status: string | null
    } | null

    if (!studio?.stripe_connect_account_id || studio.stripe_connect_status !== 'verified') {
      skipped++
      continue
    }

    // Only forward commission for a charge that is still actually paid (not since
    // refunded/reversed) — retrieve the source PI to confirm and get currency.
    // NOTE: a refunded PaymentIntent still reports status 'succeeded', so the
    // status check alone is NOT enough — we must inspect the underlying CHARGE's
    // refunded / amount_refunded and skip if any refund has been applied.
    let currency = 'gbp'
    try {
      const intent = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id, {
        expand: ['latest_charge'],
      })
      currency = intent.currency
      if (intent.status !== 'succeeded') {
        await supabase
          .from('studio_commission_transfers')
          .update({ status: 'failed', retry_count: MAX_RETRIES, last_error: `source PI ${intent.status}, not forwarding` })
          .eq('id', row.id)
        skipped++
        continue
      }

      // A refunded charge must never have its commission forwarded — the booking
      // was unwound. Mark the row terminal (bumped retry_count so it drops out of
      // the retry_count < MAX_RETRIES selection and is never reconsidered).
      const charge = intent.latest_charge as import('stripe').Stripe.Charge | string | null
      const isRefunded =
        typeof charge === 'object' && charge !== null
          ? charge.refunded || (charge.amount_refunded ?? 0) > 0
          : false
      if (isRefunded) {
        await supabase
          .from('studio_commission_transfers')
          .update({
            status: 'failed',
            retry_count: MAX_RETRIES,
            last_error: 'source charge refunded, not forwarding commission',
          })
          .eq('id', row.id)
        skipped++
        continue
      }
    } catch (err) {
      await supabase
        .from('studio_commission_transfers')
        .update({ retry_count: (row.retry_count ?? 0) + 1, last_error: err instanceof Error ? err.message : 'PI lookup failed' })
        .eq('id', row.id)
      continue
    }

    retried++
    try {
      // Reuse the original idempotency key: if a prior attempt actually created
      // the transfer, Stripe returns it rather than double-paying.
      const transfer = await stripe.transfers.create(
        {
          amount: row.amount_pence,
          currency,
          destination: studio.stripe_connect_account_id,
          metadata: {
            studio_id: row.studio_id,
            payment_intent_id: row.stripe_payment_intent_id,
            retried: 'true',
          },
        },
        { idempotencyKey: `studio_commission_${row.stripe_payment_intent_id}` },
      )
      await supabase
        .from('studio_commission_transfers')
        .update({ stripe_transfer_id: transfer.id, status: 'paid', last_error: null })
        .eq('id', row.id)
      paid++
    } catch (err) {
      await supabase
        .from('studio_commission_transfers')
        .update({
          status: 'failed',
          retry_count: (row.retry_count ?? 0) + 1,
          last_error: err instanceof Error ? err.message : 'transfer failed',
        })
        .eq('id', row.id)
    }
  }

  return NextResponse.json({ ok: true, considered: rows?.length ?? 0, retried, paid, skipped })
}
