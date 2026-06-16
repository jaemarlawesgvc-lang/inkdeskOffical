import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilityResult {
  available: boolean
  reason: string | null
}

export interface HoldResult {
  holdId: string
  expiresAt: string
}

// ---------------------------------------------------------------------------
// isSlotAvailable — implements the spec's 5-step check
//
// 1. Check blocked_dates — if exists, return false
// 2. Check artist_availability for day_of_week — if no record, return false
// 3. Check bookings where status IN ('confirmed','deposit_paid') — if exists, return false
// 4. Check booking_holds where expires_at > now() — if exists, return false
// 5. Return true
//
// Uses admin client to bypass RLS (called from public API routes).
// ---------------------------------------------------------------------------

export async function isSlotAvailable(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  time?: string,
): Promise<AvailabilityResult> {
  // ── Step 1: Blocked dates ──
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('artist_id', artistId)
    .eq('blocked_date', date)
    .maybeSingle()

  if (blocked) {
    return { available: false, reason: 'This date is blocked by the artist' }
  }

  // ── Step 2: Weekly availability ──
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay()

  const { data: availability } = await supabase
    .from('artist_availability')
    .select('id, start_time, end_time')
    .eq('artist_id', artistId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  if (!availability) {
    return { available: false, reason: 'The artist is not available on this day' }
  }

  // If a specific time was requested, check it falls within the availability window
  if (time) {
    const reqMinutes = timeToMinutes(time)
    const startMinutes = timeToMinutes(availability.start_time)
    const endMinutes = timeToMinutes(availability.end_time)

    if (reqMinutes < startMinutes || reqMinutes >= endMinutes) {
      return { available: false, reason: 'The requested time is outside the artist\'s available hours' }
    }
  }

  // ── Step 3: Existing confirmed/deposit_paid bookings ──
  const bookingQuery = supabase
    .from('bookings')
    .select('id')
    .eq('artist_id', artistId)
    .eq('booking_date', date)
    .in('status', ['confirmed', 'deposit_paid'])
    .is('deleted_at', null)

  if (time) {
    bookingQuery.eq('booking_time', time)
  }

  const { data: existingBookings } = await bookingQuery

  if (existingBookings && existingBookings.length > 0) {
    return { available: false, reason: 'This slot is already booked' }
  }

  // ── Step 4: Active booking holds ──
  const holdQuery = supabase
    .from('booking_holds')
    .select('id')
    .eq('artist_id', artistId)
    .eq('booking_date', date)
    .gt('expires_at', new Date().toISOString())

  if (time) {
    holdQuery.eq('booking_time', time)
  }

  const { data: activeHolds } = await holdQuery

  if (activeHolds && activeHolds.length > 0) {
    return { available: false, reason: 'This slot is temporarily held by another client' }
  }

  // ── Step 5: Available ──
  return { available: true, reason: null }
}

// ---------------------------------------------------------------------------
// createBookingHold — creates a 15-minute hold
// ---------------------------------------------------------------------------

export async function createBookingHold(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  time: string | undefined,
  sessionId: string,
): Promise<HoldResult> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('booking_holds')
    .insert({
      artist_id: artistId,
      booking_date: date,
      booking_time: time ?? null,
      session_id: sessionId,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single()

  if (error) {
    throw new Error(`Failed to create booking hold: ${error.message}`)
  }

  return {
    holdId: data.id,
    expiresAt: data.expires_at,
  }
}

// ---------------------------------------------------------------------------
// validateHold — checks that a hold exists, belongs to the session, and
// hasn't expired
// ---------------------------------------------------------------------------

export interface HoldValidation {
  valid: boolean
  reason: string | null
  hold: {
    id: string
    artistId: string
    bookingDate: string
    bookingTime: string | null
    expiresAt: string
  } | null
}

export async function validateHold(
  supabase: SupabaseClient,
  holdId: string,
  sessionId: string,
): Promise<HoldValidation> {
  const { data: hold, error } = await supabase
    .from('booking_holds')
    .select('id, artist_id, booking_date, booking_time, expires_at, session_id')
    .eq('id', holdId)
    .single()

  if (error || !hold) {
    return { valid: false, reason: 'Booking hold not found or has expired', hold: null }
  }

  if (hold.session_id !== sessionId) {
    return { valid: false, reason: 'Session mismatch — this hold belongs to another session', hold: null }
  }

  if (new Date(hold.expires_at) < new Date()) {
    return { valid: false, reason: 'Your booking hold has expired. Please start again.', hold: null }
  }

  return {
    valid: true,
    reason: null,
    hold: {
      id: hold.id,
      artistId: hold.artist_id,
      bookingDate: hold.booking_date,
      bookingTime: hold.booking_time,
      expiresAt: hold.expires_at,
    },
  }
}

// ---------------------------------------------------------------------------
// generateAccessToken — crypto-random token for client booking status lookup
// ---------------------------------------------------------------------------

export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeToMinutes(time: string): number {
  const parts = time.slice(0, 5).split(':')
  return Number(parts[0]) * 60 + Number(parts[1])
}
