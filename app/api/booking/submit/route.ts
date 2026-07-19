import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { submitBookingSchema } from '@/lib/validations/booking'
import { validateHold } from '@/lib/booking/availability'
import { CONSULTATION_DURATION_HOURS } from '@/lib/constants'
import { resolveActivePlan, checkBooleanFeature } from '@/lib/stripe/plans'
import { loadBookingWithArtist, sendBookingPending, sendArtistNotification } from '@/lib/resend/send'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = submitBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const {
    artistId,
    holdId,
    sessionId,
    clientName,
    clientEmail,
    clientPhone,
    bookingDate,
    bookingTime,
    durationHours,
    description,
    referenceImagePaths,
    flashDesignId,
  } = parsed.data

  const supabase = createSupabaseAdminClient()

  // ── 1. Load artist and verify ──
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select(
      'id, user_id, deposit_required, deposit_amount, onboarding_complete, zoom_link',
    )
    .eq('id', artistId)
    .is('deleted_at', null)
    .single()

  if (artistError || !artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  // ── 2. Validate the booking hold ──
  const holdValidation = await validateHold(supabase, holdId, sessionId)

  if (!holdValidation.valid || !holdValidation.hold) {
    return NextResponse.json(
      { error: holdValidation.reason ?? 'Invalid booking hold' },
      { status: 410 },
    )
  }

  // Verify hold matches submitted data
  if (
    holdValidation.hold.artistId !== artistId ||
    holdValidation.hold.bookingDate !== bookingDate
  ) {
    return NextResponse.json(
      { error: 'Hold does not match the submitted booking details' },
      { status: 422 },
    )
  }

  // DB 'time' columns round-trip as "HH:MM:SS"; the form submits "HH:MM".
  if (
    bookingTime &&
    holdValidation.hold.bookingTime?.slice(0, 5) !== bookingTime.slice(0, 5)
  ) {
    return NextResponse.json(
      { error: 'Hold time does not match the submitted booking time' },
      { status: 422 },
    )
  }

  // ── 3. Re-check availability (race safety) ──
  // Exclude current hold from the check by checking bookings only
  const conflictQuery = supabase
    .from('bookings')
    .select('id')
    .eq('artist_id', artistId)
    .eq('booking_date', bookingDate)
    .in('status', ['confirmed', 'deposit_paid'])
    .is('deleted_at', null)

  if (bookingTime) {
    conflictQuery.eq('booking_time', bookingTime)
  }

  const { data: conflicts } = await conflictQuery

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'This slot was just booked by someone else' },
      { status: 409 },
    )
  }

  // ── 4. Determine booking path: deposit or manual ──
  const requiresDeposit = artist.deposit_required && artist.deposit_amount

  // If deposit is required, verify the artist's plan allows it
  if (requiresDeposit) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', artist.user_id)
      .maybeSingle()

    const plan = resolveActivePlan(subscription)
    const depositCheck = checkBooleanFeature(plan, 'stripe_deposits')

    if (!depositCheck.allowed) {
      // Artist's plan doesn't support deposits — fall back to manual confirmation
      // The booking proceeds without deposit (artist still gets the booking)
    }
  }

  // ── 5. Check metered booking limit for this artist ──
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', artist.user_id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  // Count this month's bookings for plan enforcement
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyBookings } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artistId)
    .gte('created_at', monthStart.toISOString())
    .is('deleted_at', null)

  const { checkMeteredFeature } = await import('@/lib/stripe/plans')
  const bookingCheck = checkMeteredFeature(plan, 'bookings', monthlyBookings ?? 0)

  if (!bookingCheck.allowed) {
    return NextResponse.json(
      {
        error: 'This artist has reached their monthly booking limit. Please try again later.',
        limitReached: true,
      },
      { status: 403 },
    )
  }

  // ── 6. Create booking ──
  // Determine if deposit path is active (artist requires it AND plan allows it)
  const depositCheck = requiresDeposit
    ? checkBooleanFeature(plan, 'stripe_deposits')
    : null
  const depositActive = requiresDeposit && depositCheck?.allowed

  const initialStatus = depositActive ? 'pending' : 'pending'
  // Both paths start as 'pending':
  // - Deposit path: 'pending' → client pays → webhook sets 'deposit_paid'
  // - Manual path: 'pending' → artist confirms → 'confirmed'

  // bookings.description has a CHECK (length 10–1000). Store null for anything
  // shorter so a brief note can't reject the booking, and clamp to 1000.
  const trimmedDescription = (description ?? '').trim()
  const safeDescription =
    trimmedDescription.length >= 10 ? trimmedDescription.slice(0, 1000) : null

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      artist_id: artistId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      booking_date: bookingDate,
      booking_time: bookingTime ?? null,
      // Public bookings are consultations (~30 min). Tattoo sessions are
      // scheduled separately by the artist after the consultation.
      duration_hours: durationHours ?? CONSULTATION_DURATION_HOURS,
      description: safeDescription,
      // Correct column is reference_image_paths (text[] NOT NULL, default {}).
      // Always pass the array — never null or the old `reference_images` name.
      reference_image_paths: referenceImagePaths,
      status: initialStatus,
      deposit_amount: depositActive ? artist.deposit_amount : null,
      deposit_paid: false,
      zoom_link: artist.zoom_link || null,
      flash_design_id: flashDesignId || null,
      // access_token is a NOT NULL uuid with a DB default. The old code inserted
      // a 64-char hex string, which is invalid uuid syntax and failed every
      // insert — let Postgres generate it and read it back for the status link.
    })
    .select('id, status, deposit_amount, access_token')
    .single()

  if (bookingError || !booking) {
    console.error('[submit-booking] insert error:', bookingError?.message)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // If a flash design was chosen, atomically claim it: only flip 'available' →
  // 'booked'. If no row was affected the flash was already taken (oversold race),
  // so roll back the just-created booking and reject. Nothing references the
  // booking yet (client upsert + emails happen below), so a hard delete is safe.
  if (flashDesignId) {
    const { data: claimedFlash, error: flashError } = await supabase
      .from('flash_designs')
      .update({ status: 'booked' })
      .eq('id', flashDesignId)
      .eq('status', 'available')
      .select('id')

    if (flashError) {
      console.error('[submit-booking] failed to update flash design status:', flashError.message)
    } else if (!claimedFlash || claimedFlash.length === 0) {
      await supabase.from('bookings').delete().eq('id', booking.id)
      return NextResponse.json(
        { error: 'This flash design has just been booked by someone else.' },
        { status: 409 },
      )
    }
  }

  // ── 7. Upsert client record ──
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, booking_count')
    .eq('artist_id', artistId)
    .eq('email', clientEmail)
    .maybeSingle()

  if (existingClient) {
    await supabase
      .from('clients')
      .update({
        name: clientName,
        phone: clientPhone || undefined,
        last_booking_at: new Date().toISOString(),
        booking_count: (existingClient.booking_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingClient.id)
  } else {
    await supabase.from('clients').insert({
      artist_id: artistId,
      name: clientName,
      email: clientEmail,
      phone: clientPhone || null,
      last_booking_at: new Date().toISOString(),
      booking_count: 1,
    })
  }

  // ── Notify: pending email to client, new-booking email to artist ──
  // The deposit path's artist notification is sent by the Stripe webhook once
  // payment succeeds, so it's skipped here to avoid double-notifying the artist.
  // Awaited (each wrapped in .catch) rather than fire-and-forget: on serverless
  // the function can be frozen the instant the response is sent, so a promise
  // left un-awaited could be killed mid-send.
  const notifyBookingData = await loadBookingWithArtist(supabase, booking.id)
  if (notifyBookingData) {
    const emailTasks = [
      sendBookingPending(supabase, notifyBookingData).catch((err) => {
        console.error('[submit-booking] pending email failed:', err instanceof Error ? err.message : err)
      }),
    ]
    if (!depositActive) {
      emailTasks.push(
        sendArtistNotification(supabase, notifyBookingData).catch((err) => {
          console.error('[submit-booking] artist notification failed:', err instanceof Error ? err.message : err)
        }),
      )
    }
    await Promise.allSettled(emailTasks)
  }

  // ── 8. Build response ──
  const response: {
    bookingId: string
    accessToken: string
    status: string
    requiresDeposit: boolean
    depositAmount: number | null
  } = {
    bookingId: booking.id,
    accessToken: booking.access_token as string,
    status: booking.status,
    requiresDeposit: !!depositActive,
    depositAmount: depositActive ? artist.deposit_amount : null,
  }

  // The hold is intentionally NOT deleted here. The just-created 'pending' booking
  // now occupies the slot (SLOT_OCCUPYING_STATUSES + the widened exclusion
  // constraint), and leaving the hold in place keeps the slot reserved with no
  // gap until it expires naturally (15 min) or is cleared on confirmation. Deleting
  // it early re-opened a brief double-booking window on the no-deposit path.

  return NextResponse.json(response, { status: 201 })
}
