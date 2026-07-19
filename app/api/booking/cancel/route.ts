import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { loadBookingWithArtist, sendBookingCancelled } from '@/lib/resend/send'
import { notifyCancellationOpening } from '@/lib/booking/notify-cancellation-opening'
import { getStripe } from '@/lib/stripe/server'
import { refundDepositCharge } from '@/lib/stripe/refunds'
import { fromZonedTime } from 'date-fns-tz'
import { z } from 'zod'

// A client may cancel a booking that hasn't happened yet.
const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'deposit_paid']

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  token: z.string().min(1),
})

/**
 * Client-initiated cancellation with the deposit no-show policy:
 *   • Cancelled EARLIER than the artist's cancellation window → deposit refunded
 *   • Cancelled LATER than the window (a late cancel)          → deposit forfeited
 * The artist-side cancel (dashboard) always refunds; this is the path with teeth.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { bookingId, token } = parsed.data
  const db = createSupabaseAdminClient()

  const { data: booking, error: bookingErr } = await db
    .from('bookings')
    .select(
      'id, artist_id, access_token, booking_date, booking_time, status, deleted_at, stripe_payment_intent_id, deposit_paid, deposit_forfeited, deposit_refunded',
    )
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.access_token !== token) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 403 })
  }

  if (booking.deleted_at || !CANCELLABLE_STATUSES.includes(booking.status)) {
    return NextResponse.json(
      { error: 'This booking can no longer be cancelled.' },
      { status: 409 },
    )
  }

  // Resolve the artist's cancellation window + timezone to decide timely vs late.
  const { data: artist } = await db
    .from('artists')
    .select('cancellation_window_hours, timezone, display_name, username')
    .eq('id', booking.artist_id)
    .single()

  const windowHours = artist?.cancellation_window_hours ?? 48
  const timezone = artist?.timezone ?? 'Europe/London'

  let timely = true // no scheduled time yet (e.g. consultation request) → treat as timely
  if (booking.booking_date && booking.booking_time) {
    const apptDateStr = `${booking.booking_date}T${booking.booking_time.slice(0, 5)}:00`
    const apptTime = fromZonedTime(apptDateStr, timezone).getTime()
    const hoursUntil = (apptTime - Date.now()) / (1000 * 60 * 60)
    timely = hoursUntil >= windowHours
  }

  // Apply the deposit policy (idempotent; non-fatal).
  let depositOutcome: 'refunded' | 'forfeited' | 'none' = 'none'
  if (
    booking.stripe_payment_intent_id &&
    booking.deposit_paid &&
    !booking.deposit_forfeited &&
    !booking.deposit_refunded
  ) {
    if (timely) {
      // Timely cancellation → full refund (unwinds the artist share + any studio
      // commission transfer via the shared helper).
      const result = await refundDepositCharge(db, booking.stripe_payment_intent_id)
      if (['refunded', 'released', 'already'].includes(result.outcome)) {
        depositOutcome = 'refunded'
      } else {
        console.error('[booking/cancel] refund failed:', result.reason)
      }
    } else {
      // Late cancellation → forfeit: capture a still-held intent; an already
      // auto-captured deposit (and its studio commission) simply stays put.
      try {
        const stripe = getStripe()
        const intent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
        if (intent.status === 'requires_capture') {
          await stripe.paymentIntents.capture(intent.id)
        }
        depositOutcome = 'forfeited'
      } catch (err) {
        console.error(
          '[booking/cancel] forfeit capture failed:',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  const { error: updateErr } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      ...(depositOutcome === 'refunded'
        ? { deposit_refunded: true, stripe_payment_status: 'refunded' }
        : {}),
      ...(depositOutcome === 'forfeited' ? { deposit_forfeited: true } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (updateErr) {
    console.error('[booking/cancel] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }

  // Notify the client (confirmation) and surface the freed slot to the waitlist.
  const bookingData = await loadBookingWithArtist(db, bookingId)
  if (bookingData) {
    await sendBookingCancelled(db, bookingData).catch((err) => {
      console.error('[booking/cancel] email failed:', err instanceof Error ? err.message : err)
    })
  }

  if (booking.booking_date && artist) {
    const { data: artistDetails } = await db
      .from('artists')
      .select('display_name, username, profiles ( email )')
      .eq('id', booking.artist_id)
      .single()
    if (artistDetails) {
      const artistProfile = artistDetails.profiles as unknown as { email: string } | null
      void notifyCancellationOpening(db, {
        artistId: booking.artist_id,
        artistName: artistDetails.display_name ?? artistDetails.username,
        artistUsername: artistDetails.username,
        cancelledDate: booking.booking_date,
        artistEmail: artistProfile?.email ?? null,
      })
    }
  }

  return NextResponse.json({ ok: true, deposit: depositOutcome, timely })
}
