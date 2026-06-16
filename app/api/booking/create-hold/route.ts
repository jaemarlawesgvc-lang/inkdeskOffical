import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createHoldSchema } from '@/lib/validations/booking'
import { isSlotAvailable, createBookingHold } from '@/lib/booking/availability'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createHoldSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { artistId, date, time, sessionId } = parsed.data
  const supabase = createSupabaseAdminClient()

  // Verify artist exists and is publicly bookable
  const { data: artist } = await supabase
    .from('artists')
    .select('id, onboarding_complete')
    .eq('id', artistId)
    .is('deleted_at', null)
    .single()

  if (!artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  // Check availability before creating hold
  const availability = await isSlotAvailable(supabase, artistId, date, time)

  if (!availability.available) {
    return NextResponse.json(
      { error: availability.reason ?? 'Slot not available' },
      { status: 409 },
    )
  }

  // Check if this session already has an active hold for this slot
  const existingHoldQuery = supabase
    .from('booking_holds')
    .select('id, expires_at')
    .eq('artist_id', artistId)
    .eq('booking_date', date)
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())

  if (time) {
    existingHoldQuery.eq('booking_time', time)
  }

  const { data: existingHold } = await existingHoldQuery.maybeSingle()

  if (existingHold) {
    // Return existing hold instead of creating a duplicate
    return NextResponse.json({
      holdId: existingHold.id,
      expiresAt: existingHold.expires_at,
      reused: true,
    })
  }

  try {
    const hold = await createBookingHold(supabase, artistId, date, time, sessionId)
    return NextResponse.json({ ...hold, reused: false }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create hold'
    console.error('[create-hold] error:', message)
    return NextResponse.json({ error: 'Failed to reserve this slot' }, { status: 500 })
  }
}
