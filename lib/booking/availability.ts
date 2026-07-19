import type { SupabaseClient } from '@supabase/supabase-js'
import { CONSULTATION_DURATION_HOURS } from '@/lib/constants'
import { getConsultationSlotsForDate } from '@/lib/booking/consultation-slots'

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
// isSlotAvailable — consultation slot model with overlap detection
// ---------------------------------------------------------------------------

export async function isSlotAvailable(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  time?: string,
  durationHours: number = CONSULTATION_DURATION_HOURS,
): Promise<AvailabilityResult> {
  const { slots, reason } = await getConsultationSlotsForDate(
    supabase,
    artistId,
    date,
    durationHours,
  )

  if (reason) {
    return { available: false, reason }
  }

  // Date-level check: at least one consultation slot remains
  if (!time) {
    const hasOpenSlot = slots.some((s) => s.available)
    return hasOpenSlot
      ? { available: true, reason: null }
      : { available: false, reason: 'No consultation slots available on this date' }
  }

  // Time-level check: slot exists within hours and does not overlap
  const matchingSlot = slots.find((s) => s.time === time)
  if (!matchingSlot) {
    return { available: false, reason: 'The requested time is outside available consultation hours' }
  }

  if (!matchingSlot.available) {
    return { available: false, reason: 'This consultation slot is already booked' }
  }

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
  durationHours: number = CONSULTATION_DURATION_HOURS,
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
      duration_hours: durationHours,
    })
    .select('id, expires_at')
    .single()

  if (error) {
    // Preserve the Postgres error code (e.g. 23505 unique_violation from the
    // booking_holds_active_slot_unique index) so the API can return a clean
    // "slot just taken" response instead of a generic 500.
    const holdError = new Error(`Failed to create booking hold: ${error.message}`) as Error & {
      code?: string
    }
    holdError.code = error.code
    throw holdError
  }

  return {
    holdId: data.id,
    expiresAt: data.expires_at,
  }
}

// ---------------------------------------------------------------------------
// validateHold
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
    durationHours: number
  } | null
}

export async function validateHold(
  supabase: SupabaseClient,
  holdId: string,
  sessionId: string,
): Promise<HoldValidation> {
  const { data: hold, error } = await supabase
    .from('booking_holds')
    .select('id, artist_id, booking_date, booking_time, expires_at, session_id, duration_hours')
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
      durationHours: Number(hold.duration_hours) || CONSULTATION_DURATION_HOURS,
    },
  }
}

// ---------------------------------------------------------------------------
// isFullyBookedNext14Days — true when every open day has zero free slots
// ---------------------------------------------------------------------------

export async function isFullyBookedNext14Days(
  supabase: SupabaseClient,
  artistId: string,
): Promise<boolean> {
  const today = new Date()
  const dates: string[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const [{ data: availability }, { data: blocked }] = await Promise.all([
    supabase.from('artist_availability').select('day_of_week').eq('artist_id', artistId),
    supabase.from('blocked_dates').select('blocked_date').eq('artist_id', artistId).in('blocked_date', dates),
  ])

  const availableDaysOfWeek = new Set((availability ?? []).map((a) => a.day_of_week))
  const blockedDates = new Set((blocked ?? []).map((b) => b.blocked_date))

  const openDays = dates.filter((date) => {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay()
    return availableDaysOfWeek.has(dayOfWeek) && !blockedDates.has(date)
  })

  if (openDays.length === 0) return false

  for (const date of openDays) {
    const { slots } = await getConsultationSlotsForDate(supabase, artistId, date)
    if (slots.some((s) => s.available)) {
      return false
    }
  }

  return true
}
