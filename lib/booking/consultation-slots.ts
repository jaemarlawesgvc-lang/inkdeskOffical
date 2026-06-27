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

export async function getConsultationSlotsForDate(
  supabase: SupabaseClient,
  artistId: string,
  date: string,
  durationHours: number = CONSULTATION_DURATION_HOURS,
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

  const { data: availability } = await supabase
    .from('artist_availability')
    .select('start_time, end_time')
    .eq('artist_id', artistId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  let workingHours = availability

  if (!workingHours) {
    const { count } = await supabase
      .from('artist_availability')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)

    if (count === 0) {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingHours = { start_time: '09:00:00', end_time: '17:00:00' }
      }
    }
  }

  if (!workingHours) {
    return { slots: [], reason: 'The artist is not available on this day' }
  }

  const allSlots = generateSlotTimes(
    workingHours.start_time,
    workingHours.end_time,
    CONSULTATION_SLOT_INTERVAL_MINUTES,
    durationHours,
  )

  const occupied = await loadOccupiedRanges(supabase, artistId, date)

  const slots: ConsultationSlot[] = allSlots.map((time) => {
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

  const ranges: OccupiedRange[] = []

  for (const row of bookings ?? []) {
    if (!row.booking_time) continue
    const start = timeToMinutes(row.booking_time)
    const duration = Number(row.duration_hours ?? CONSULTATION_DURATION_HOURS)
    ranges.push({ startMinutes: start, endMinutes: start + duration * 60 })
  }

  for (const row of holds ?? []) {
    if (!row.booking_time) continue
    const start = timeToMinutes(row.booking_time)
    const duration = Number(row.duration_hours ?? CONSULTATION_DURATION_HOURS)
    ranges.push({ startMinutes: start, endMinutes: start + duration * 60 })
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
