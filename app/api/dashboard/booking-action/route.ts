import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { notifyCancellationOpening } from '@/lib/booking/notify-cancellation-opening'
import { loadBookingWithArtist, sendBookingConfirmation, sendBookingCancelled, sendBookingCompleted, sendBookingUpgraded } from '@/lib/resend/send'
import { getStripe } from '@/lib/stripe/server'
import { refundDepositCharge } from '@/lib/stripe/refunds'
import { logAnalyticsEvent } from '@/lib/analytics/events'
import { z } from 'zod'

const schema = z.object({
  bookingId: z.string().uuid(),
  artistId: z.string().uuid(),
  action: z.enum(['confirm', 'cancel', 'complete', 'add_note', 'upgrade', 'no_show']),
  note: z.string().max(1000).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  bookingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM').optional(),
  durationHours: z.number().positive().max(16).optional(),
  totalAmount: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
})

const STATUS_TRANSITIONS: Record<string, string> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
  complete: 'completed',
  no_show: 'no_show',
}

/**
 * Forfeit a booking's deposit to the artist by capturing its manual-capture
 * PaymentIntent. Handles the real-world states gracefully:
 *   • requires_capture  → capture now (the forfeit path for manual intents)
 *   • succeeded         → auto-capture deposit already collected → already forfeited
 *   • anything else      → nothing to forfeit (canceled / unpaid / processing)
 * Never throws — returns whether the deposit is now (or already) forfeited.
 */
async function forfeitDeposit(
  intentId: string,
): Promise<{ forfeited: boolean; reason: string }> {
  try {
    const stripe = getStripe()
    const intent = await stripe.paymentIntents.retrieve(intentId)
    if (intent.status === 'requires_capture') {
      await stripe.paymentIntents.capture(intentId)
      return { forfeited: true, reason: 'captured' }
    }
    if (intent.status === 'succeeded') {
      // Deposit was auto-captured at payment time — funds already sit with the
      // artist, so it counts as forfeited without any further Stripe call.
      return { forfeited: true, reason: 'already_captured' }
    }
    return { forfeited: false, reason: `intent status ${intent.status}` }
  } catch (err) {
    return { forfeited: false, reason: err instanceof Error ? err.message : 'capture failed' }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { bookingId, artistId, action, note } = parsed.data

  // Confirm this artist belongs to the authed user
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ownership verified above. Use the service-role client for the booking reads
  // and writes so confirm/cancel/complete don't depend on the bookings UPDATE
  // RLS policy / current_artist_id() helper being present. Every operation is
  // scoped to this artist's own bookings via .eq('artist_id', artistId).
  const db = createSupabaseAdminClient()

  if (action === 'add_note') {
    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 422 })
    }
    // Append to existing notes using a simple timestamped format
    const { data: existing } = await db
      .from('bookings')
      .select('notes')
      .eq('id', bookingId)
      .eq('artist_id', artistId)
      .single()

    const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    const newNote = existing?.notes
      ? `${existing.notes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`

    const { error } = await db
      .from('bookings')
      .update({ notes: newNote, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('artist_id', artistId)

    if (error) {
      console.error('[booking-action] note update failed:', error.message)
      return NextResponse.json({ error: error.message || 'Failed to save note' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'upgrade') {
    const { bookingDate, bookingTime, durationHours, totalAmount, depositAmount } = parsed.data
    if (!bookingDate || !bookingTime || !durationHours || totalAmount === undefined || depositAmount === undefined) {
      return NextResponse.json({ error: 'Missing required upgrade parameters' }, { status: 422 })
    }

    const { error } = await db
      .from('bookings')
      .update({
        booking_type: 'live',
        booking_date: bookingDate,
        booking_time: bookingTime.slice(0, 5),
        duration_hours: durationHours,
        total_amount: totalAmount,
        deposit_amount: depositAmount,
        deposit_paid: false,
        status: 'pending',
        stripe_payment_intent_id: null, // Clear old payment intent to allow new checkout session
        stripe_payment_status: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .eq('artist_id', artistId)

    if (error) {
      console.error('[booking-action] upgrade failed:', error.message)
      return NextResponse.json({ error: error.message || 'Upgrade failed' }, { status: 500 })
    }

    // Send email to client
    const notifyBookingData = await loadBookingWithArtist(db, bookingId)
    if (notifyBookingData) {
      await sendBookingUpgraded(db, notifyBookingData).catch((err) => {
        console.error('[booking-action] upgrade email failed:', err instanceof Error ? err.message : err)
      })
    }

    return NextResponse.json({ ok: true })
  }

  const newStatus = STATUS_TRANSITIONS[action]
  if (!newStatus) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 422 })
  }

  // Capture the booking date before updating, for the cancellation-recovery notification.
  const { data: bookingBeforeUpdate } = await db
    .from('bookings')
    .select('booking_date')
    .eq('id', bookingId)
    .eq('artist_id', artistId)
    .single()

  const { error } = await db
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('artist_id', artistId)

  if (error) {
    console.error(`[booking-action] ${action} failed:`, error.message)
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 })
  }

  // Funnel: a completed booking is the terminal success event.
  if (action === 'complete') {
    void logAnalyticsEvent(artistId, 'booking_completed', { bookingId })
  }

  // Notify the client of the status change. Awaited (with .catch) so the send
  // actually completes before this serverless invocation can be frozen.
  if (action === 'confirm' || action === 'cancel' || action === 'complete') {
    const notifyBookingData = await loadBookingWithArtist(db, bookingId)
    if (notifyBookingData) {
      if (action === 'confirm') {
        // Always attempt this, even for deposit-bearing bookings the artist
        // confirmed manually ahead of payment — sendEmail() dedupes on
        // (bookingId, emailType), so if the Stripe webhook already sent (or
        // later sends) its own booking_confirmation for this booking, the
        // extra attempt is a safe no-op rather than a real double-send.
        await sendBookingConfirmation(db, notifyBookingData).catch((err) => {
          console.error('[booking-action] confirm email failed:', err instanceof Error ? err.message : err)
        })
      } else if (action === 'cancel') {
        await sendBookingCancelled(db, notifyBookingData).catch((err) => {
          console.error('[booking-action] cancel email failed:', err instanceof Error ? err.message : err)
        })
      } else {
        await sendBookingCompleted(db, notifyBookingData).catch((err) => {
          console.error('[booking-action] complete email failed:', err instanceof Error ? err.message : err)
        })
      }
    }
  }

  if (action === 'cancel' && bookingBeforeUpdate) {
    // Fire-and-forget: notify pending/waitlisted clients of the freed-up slot.
    // Uses the admin client because email_logs writes require service role.
    const adminClient = createSupabaseAdminClient()
    const { data: artistDetails } = await adminClient
      .from('artists')
      .select('display_name, username, profiles ( email )')
      .eq('id', artistId)
      .single()

    if (artistDetails) {
      const artistProfile = artistDetails.profiles as unknown as { email: string } | null
      void notifyCancellationOpening(adminClient, {
        artistId,
        artistName: artistDetails.display_name ?? artistDetails.username,
        artistUsername: artistDetails.username,
        cancelledDate: bookingBeforeUpdate.booking_date,
        artistEmail: artistProfile?.email ?? null,
      })
    }
  }

  // Artist-initiated cancellation → always refund the client's deposit. The
  // artist cancelling is never the client's fault, so no forfeit applies here
  // (client-initiated late cancels are handled by /api/booking/cancel). Idempotent
  // via deposit_refunded; non-fatal so the status change always succeeds.
  if (action === 'cancel') {
    const { data: bookingRow } = await db
      .from('bookings')
      .select('stripe_payment_intent_id, deposit_paid, deposit_forfeited, deposit_refunded')
      .eq('id', bookingId)
      .eq('artist_id', artistId)
      .single()

    if (
      bookingRow?.stripe_payment_intent_id &&
      bookingRow.deposit_paid &&
      !bookingRow.deposit_forfeited &&
      !bookingRow.deposit_refunded
    ) {
      const result = await refundDepositCharge(db, bookingRow.stripe_payment_intent_id)
      if (result.outcome === 'refunded' || result.outcome === 'released' || result.outcome === 'already') {
        const { error: refundErr } = await db
          .from('bookings')
          .update({ deposit_refunded: true, stripe_payment_status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('artist_id', artistId)
        if (refundErr) {
          console.error('[booking-action] deposit_refunded flag update failed:', refundErr.message)
        }
      } else {
        console.info(`[booking-action] cancel ${bookingId}: deposit not refunded (${result.reason})`)
      }
    }
  }

  // No-show deposit forfeit: when an artist marks a booking as a no-show and has
  // auto-forfeit enabled, capture (forfeit) the manual-capture deposit to the
  // artist. Idempotent via the deposit_forfeited flag; failures are non-fatal so
  // the status change itself always succeeds.
  if (action === 'no_show') {
    const { data: bookingRow } = await db
      .from('bookings')
      .select('stripe_payment_intent_id, deposit_forfeited')
      .eq('id', bookingId)
      .eq('artist_id', artistId)
      .single()

    const { data: artistRow } = await db
      .from('artists')
      .select('auto_forfeit_no_shows')
      .eq('id', artistId)
      .single()

    const autoForfeit = artistRow?.auto_forfeit_no_shows ?? true

    if (autoForfeit && bookingRow?.stripe_payment_intent_id && !bookingRow.deposit_forfeited) {
      const result = await forfeitDeposit(bookingRow.stripe_payment_intent_id)
      if (result.forfeited) {
        const { error: forfeitErr } = await db
          .from('bookings')
          .update({ deposit_forfeited: true, updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('artist_id', artistId)
        if (forfeitErr) {
          console.error('[booking-action] deposit_forfeited flag update failed:', forfeitErr.message)
        }
      } else {
        console.info(`[booking-action] no_show ${bookingId}: deposit not forfeited (${result.reason})`)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
