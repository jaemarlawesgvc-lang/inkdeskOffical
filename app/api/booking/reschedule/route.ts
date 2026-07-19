import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { isSlotAvailable } from '@/lib/booking/availability'
import { loadBookingWithArtist, sendBookingRescheduled } from '@/lib/resend/send'
import { fromZonedTime } from 'date-fns-tz'
import { z } from 'zod'

// Bookings that may still be rescheduled — cancelled/completed/no_show cannot.
const RESCHEDULABLE_STATUSES = ['pending', 'confirmed', 'deposit_paid']

const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM'),
  token: z.string().optional(), // Provided by client status page
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = rescheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { bookingId, date, time, token } = parsed.data
  const cleanTime = time.slice(0, 5) // Normalize to HH:MM

  const supabase = await createSupabaseServerClient()
  const adminDb = createSupabaseAdminClient()

  let artistId = ''

  // 1. Authenticate / Authorize
  if (token) {
    // Client-side reschedule via token
    const { data: booking, error: bookingErr } = await adminDb
      .from('bookings')
      .select('id, artist_id, access_token, booking_date, booking_time, status, deleted_at')
      .eq('id', bookingId)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.access_token !== token) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 403 })
    }

    // Only active, non-deleted bookings can be rescheduled.
    if (booking.deleted_at || !RESCHEDULABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: 'This booking can no longer be rescheduled.' },
        { status: 409 },
      )
    }

    // POLICY CHECK: Enforce 48h rescheduling lockout for clients.
    // booking_time is stored in the artist's LOCAL timezone, so interpret the
    // wall-clock appointment in that zone (fromZonedTime → UTC) before diffing.
    if (booking.booking_date && booking.booking_time) {
      const { data: artistTz } = await adminDb
        .from('artists')
        .select('timezone')
        .eq('id', booking.artist_id)
        .single()
      const timezone = artistTz?.timezone ?? 'Europe/London'

      const apptDateStr = `${booking.booking_date}T${booking.booking_time.slice(0, 5)}:00`
      const apptTime = fromZonedTime(apptDateStr, timezone).getTime()
      const now = Date.now()
      const hoursDiff = (apptTime - now) / (1000 * 60 * 60)

      if (hoursDiff < 48) {
        return NextResponse.json(
          { error: 'Rescheduling is locked within 48 hours of the appointment time.' },
          { status: 400 },
        )
      }
    }

    artistId = booking.artist_id
  } else {
    // Artist-side reschedule via session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 })
    }

    // Verify booking belongs to this artist
    const { data: booking, error: bookingErr } = await adminDb
      .from('bookings')
      .select('id, artist_id, status, deleted_at')
      .eq('id', bookingId)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.artist_id !== artist.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only active, non-deleted bookings can be rescheduled.
    if (booking.deleted_at || !RESCHEDULABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: 'This booking can no longer be rescheduled.' },
        { status: 409 },
      )
    }

    artistId = artist.id
  }

  // 2. Validate Slot Availability
  const avail = await isSlotAvailable(adminDb, artistId, date, cleanTime)
  if (!avail.available) {
    return NextResponse.json(
      { error: avail.reason ?? 'This slot is no longer available' },
      { status: 422 },
    )
  }

  // 3. Update database
  const { error: updateError } = await adminDb
    .from('bookings')
    .update({
      booking_date: date,
      booking_time: cleanTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('[reschedule] update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to reschedule appointment' }, { status: 500 })
  }

  // 4. Send rescheduled emails
  const bookingData = await loadBookingWithArtist(adminDb, bookingId)
  if (bookingData) {
    await sendBookingRescheduled(adminDb, bookingData).catch((err) => {
      console.error('[reschedule] email notify error:', err instanceof Error ? err.message : err)
    })
  }

  return NextResponse.json({ ok: true })
}
