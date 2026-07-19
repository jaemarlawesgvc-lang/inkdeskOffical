import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

// Vercel calls cron routes with GET; POST is accepted for manual triggering.
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

interface CandidateArtist {
  cancellation_window_hours: number | null
  auto_forfeit_no_shows: boolean | null
}

/**
 * Forfeit a still-uncaptured manual deposit to the artist. Only captures intents
 * in `requires_capture` — anything already succeeded/cancelled/unpaid is left
 * alone (nothing to forfeit or already settled), keeping the sweep idempotent.
 */
async function captureManualDeposit(
  intentId: string,
): Promise<{ forfeited: boolean; reason: string }> {
  try {
    const stripe = getStripe()
    const intent = await stripe.paymentIntents.retrieve(intentId)
    if (intent.status === 'requires_capture') {
      await stripe.paymentIntents.capture(intentId)
      return { forfeited: true, reason: 'captured' }
    }
    return { forfeited: false, reason: `intent status ${intent.status}` }
  } catch (err) {
    return { forfeited: false, reason: err instanceof Error ? err.message : 'capture failed' }
  }
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)

  // Candidates: appointment date already passed, still in a non-terminal state,
  // an uncaptured deposit present, not yet forfeited. Per-artist window + toggle
  // are applied in JS below (they can't be expressed in a single PostgREST filter).
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      booking_date,
      booking_time,
      stripe_payment_intent_id,
      artists (
        cancellation_window_hours,
        auto_forfeit_no_shows
      )
    `,
    )
    .in('status', ['pending', 'confirmed', 'deposit_paid'])
    .not('stripe_payment_intent_id', 'is', null)
    .eq('deposit_forfeited', false)
    .lte('booking_date', today)
    .is('deleted_at', null)

  if (error) {
    console.error('[cron/auto-forfeit] query error:', error.message)
    return NextResponse.json({ error: 'Failed to query bookings' }, { status: 500 })
  }

  const results = {
    processed: 0,
    forfeited: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const booking of bookings ?? []) {
    results.processed++

    const artist = booking.artists as unknown as CandidateArtist | null
    const autoForfeit = artist?.auto_forfeit_no_shows ?? true
    if (!autoForfeit) {
      results.skipped++
      continue
    }

    const windowHours = artist?.cancellation_window_hours ?? 48

    // Appointment instant — fall back to end-of-day when no time is set so we
    // never forfeit a same-day booking prematurely. Treated as UTC; the window
    // (>= 48h by default) dwarfs any UK/UTC offset.
    const timePart = booking.booking_time ? String(booking.booking_time).slice(0, 5) : '23:59'
    const apptMs = Date.parse(`${booking.booking_date}T${timePart}:00Z`)
    if (Number.isNaN(apptMs)) {
      results.skipped++
      continue
    }

    const hoursSince = (now - apptMs) / (60 * 60 * 1000)
    if (hoursSince <= windowHours) {
      results.skipped++
      continue
    }

    const intentId = booking.stripe_payment_intent_id as string
    const capture = await captureManualDeposit(intentId)
    if (!capture.forfeited) {
      // Nothing to capture (already settled / unpaid) — count as skipped, not a failure.
      results.skipped++
      continue
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        deposit_forfeited: true,
        status: 'no_show',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('deposit_forfeited', false)

    if (updateErr) {
      results.failed++
      results.errors.push(`${booking.id}: ${updateErr.message}`)
      continue
    }

    results.forfeited++
  }

  console.info('[cron/auto-forfeit] complete:', results)
  return NextResponse.json(results)
}
