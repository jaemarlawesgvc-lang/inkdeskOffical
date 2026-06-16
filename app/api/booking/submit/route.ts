import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { submitBookingSchema } from '@/lib/validations/booking'
import {
  validateHold,
  generateAccessToken,
} from '@/lib/booking/availability'
import { resolveActivePlan, checkBooleanFeature } from '@/lib/stripe/plans'

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
  } = parsed.data

  const supabase = createSupabaseAdminClient()

  // ── 1. Load artist and verify ──
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select(
      'id, user_id, deposit_required, deposit_amount, onboarding_complete',
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
  const accessToken = generateAccessToken()

  // Determine if deposit path is active (artist requires it AND plan allows it)
  const depositCheck = requiresDeposit
    ? checkBooleanFeature(plan, 'stripe_deposits')
    : null
  const depositActive = requiresDeposit && depositCheck?.allowed

  const initialStatus = depositActive ? 'pending' : 'pending'
  // Both paths start as 'pending':
  // - Deposit path: 'pending' → client pays → webhook sets 'deposit_paid'
  // - Manual path: 'pending' → artist confirms → 'confirmed'

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      artist_id: artistId,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      booking_date: bookingDate,
      booking_time: bookingTime ?? null,
      duration_hours: durationHours ?? null,
      description: description || null,
      reference_images: referenceImagePaths.length > 0 ? referenceImagePaths : null,
      status: initialStatus,
      deposit_amount: depositActive ? artist.deposit_amount : null,
      deposit_paid: false,
      access_token: accessToken,
    })
    .select('id, status, deposit_amount')
    .single()

  if (bookingError || !booking) {
    console.error('[submit-booking] insert error:', bookingError?.message)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
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

  // ── 8. Build response ──
  const response: {
    bookingId: string
    accessToken: string
    status: string
    requiresDeposit: boolean
    depositAmount: number | null
  } = {
    bookingId: booking.id,
    accessToken,
    status: booking.status,
    requiresDeposit: !!depositActive,
    depositAmount: depositActive ? artist.deposit_amount : null,
  }

  // Hold is kept alive for deposit path — the webhook will delete it on confirmation.
  // For manual (no-deposit) path, delete the hold now since it's no longer needed.
  if (!depositActive) {
    await supabase
      .from('booking_holds')
      .delete()
      .eq('id', holdId)
  }

  return NextResponse.json(response, { status: 201 })
}
