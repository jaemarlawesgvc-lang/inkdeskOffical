import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CONSULTATION_DURATION_HOURS,
  CONSULTATION_SLOT_INTERVAL_MINUTES,
  SLOT_OCCUPYING_STATUSES,
} from '@/lib/constants'

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function timeToMinutes(time: string): number {
  const parts = time.slice(0, 5).split(':')
  return Number(parts[0]) * 60 + Number(parts[1])
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime12h(time: string): string {
  const mins = timeToMinutes(time)
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const period = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 || 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`
}

export function formatSlotLabel(time: string, durationHours: number): string {
  const startMin = timeToMinutes(time)
  const endMin = startMin + durationHours * 60
  const endTime = minutesToTime(endMin)
  const durationLabel =
    durationHours === 0.5 ? '30 min' : durationHours === 1 ? '1 hr' : `${durationHours * 60} min`
  return `${formatTime12h(time)} – ${formatTime12h(endTime)} (${durationLabel})`
}

export function generateSlotTimes(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
  durationHours: number,
): string[] {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const durationMin = durationHours * 60
  const slots: string[] = []

  for (let t = start; t + durationMin <= end; t += intervalMinutes) {
    slots.push(minutesToTime(t))
  }
  return slots
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

// ---------------------------------------------------------------------------
// Slot availability
// ---------------------------------------------------------------------------

export interface OccupiedRange {
  startMinutes: number
  endMinutes: number
}

export interface ConsultationSlot {
  time: string
  label: string
  available: boolean
}

/**
 * Resolve the buffer/setup minutes configured on an artist. Returns 0 when the
 * column is absent (pre-022 schema) or the artist can't be read.
 */
export async function getArtistBufferMinutes(
  supabase: SupabaseClient,
  artistId: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from('artists')
      .select('buffer_minutes')
      .eq('id', artistId)
      .maybeSingle()
    const raw = (data as { buffer_minutes?: number | null } | null)?.buffer_minutes
    return Number.isFinite(raw) && (raw as number) > 0 ? Number(raw) : 0
  } catch {
    return 0
  }
}

export async function getConsultationSlotsForDate(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  durationHours: number = CONSULTATION_DURATION_HOURS,
  // Buffer/setup minutes kept clear on both sides of each occupied range.
  // undefined → auto-load from the artist so every existing caller gets buffers.
  bufferMinutes?: number,
): Promise<{ slots: ConsultationSlot[]; reason: string | null }> {
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('artist_id', artistId)
    .eq('blocked_date', date)
    .maybeSingle()

  if (blocked) {
    return { slots: [], reason: 'This date is blocked by the artist' }
  }

  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay()

  // Multiple windows per weekday (022): fetch ALL rows for the day, not one.
  const { data: availabilityRows } = await supabase
    .from('artist_availability')
    .select('start_time, end_time')
    .eq('artist_id', artistId)
    .eq('day_of_week', dayOfWeek)
    .order('start_time', { ascending: true })

  let windows: { start_time: string; end_time: string }[] = availabilityRows ?? []

  if (windows.length === 0) {
    const { count } = await supabase
      .from('artist_availability')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)

    // Keep the legacy 9–5 weekday fallback for artists with zero rows anywhere.
    if (count === 0 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      windows = [{ start_time: '09:00:00', end_time: '17:00:00' }]
    }
  }

  if (windows.length === 0) {
    return { slots: [], reason: 'The artist is not available on this day' }
  }

  const resolvedBuffer =
    bufferMinutes !== undefined ? bufferMinutes : await getArtistBufferMinutes(supabase, artistId)

  const occupied = await loadOccupiedRanges(supabase, artistId, date, resolvedBuffer)

  // Generate candidate start times across every window, deduped + ordered.
  const seen = new Set<string>()
  const candidateTimes: string[] = []
  for (const w of windows) {
    for (const time of generateSlotTimes(
      w.start_time,
      w.end_time,
      CONSULTATION_SLOT_INTERVAL_MINUTES,
      durationHours,
    )) {
      if (!seen.has(time)) {
        seen.add(time)
        candidateTimes.push(time)
      }
    }
  }
  candidateTimes.sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

  const slots: ConsultationSlot[] = candidateTimes.map((time) => {
    const start = timeToMinutes(time)
    const end = start + durationHours * 60
    const available = !occupied.some((r) => rangesOverlap(start, end, r.startMinutes, r.endMinutes))
    return {
      time,
      label: formatSlotLabel(time, durationHours),
      available,
    }
  })

  return { slots, reason: null }
}

export async function loadOccupiedRanges(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  // Padding (minutes) applied to both sides of each occupied range so free
  // slots keep a gap from existing appointments. Defaults to 0 (no buffer).
  bufferMinutes = 0,
): Promise<OccupiedRange[]> {
  const [{ data: bookings }, { data: holds }] = await Promise.all([
    supabase
      .from('bookings')
      .select('booking_time, duration_hours')
      .eq('artist_id', artistId)
      .eq('booking_date', date)
      .in('status', SLOT_OCCUPYING_STATUSES)
      .is('deleted_at', null)
      .not('booking_time', 'is', null),
    supabase
      .from('booking_holds')
      .select('booking_time, duration_hours')
      .eq('artist_id', artistId)
      .eq('booking_date', date)
      .gt('expires_at', new Date().toISOString())
      .not('booking_time', 'is', null),
  ])

  const pad = Number.isFinite(bufferMinutes) && bufferMinutes > 0 ? bufferMinutes : 0
  const ranges: OccupiedRange[] = []

  for (const row of bookings ?? []) {
    if (!row.booking_time) continue
    const start = timeToMinutes(row.booking_time)
    const duration = Number(row.duration_hours ?? CONSULTATION_DURATION_HOURS)
    ranges.push({ startMinutes: start - pad, endMinutes: start + duration * 60 + pad })
  }

  for (const row of holds ?? []) {
    if (!row.booking_time) continue
    const start = timeToMinutes(row.booking_time)
    const duration = Number(row.duration_hours ?? CONSULTATION_DURATION_HOURS)
    ranges.push({ startMinutes: start - pad, endMinutes: start + duration * 60 + pad })
  }

  return ranges
}

export function formatBookingDuration(hours: number): string {
  if (hours === 0.5) return '30 min consultation'
  if (hours === 1) return '1 hour'
  return `${hours} hours`
}

export function isTimeSlotAvailable(
  time: string,
  durationHours: number,
  occupied: OccupiedRange[],
): boolean {
  const start = timeToMinutes(time)
  const end = start + durationHours * 60
  return !occupied.some((r) => rangesOverlap(start, end, r.startMinutes, r.endMinutes))
}
