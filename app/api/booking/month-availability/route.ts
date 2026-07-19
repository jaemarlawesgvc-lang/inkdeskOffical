import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  getConsultationSlotsForDate,
  getArtistBufferMinutes,
} from '@/lib/booking/consultation-slots'
import { CONSULTATION_DURATION_HOURS } from '@/lib/constants'

// Replaces the BookingCalendar N+1: instead of one check-availability request per
// day (28–31 HTTP round-trips per month view), the calendar calls this once and
// receives a { 'YYYY-MM-DD': boolean } map for the whole month. The per-day
// availability decision reuses getConsultationSlotsForDate — the exact same logic
// check-availability uses — so behaviour stays identical.

const monthAvailabilitySchema = z.object({
  artistId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  // 1–12 (calendar sends viewMonth + 1).
  month: z.coerce.number().int().min(1).max(12),
  // Optional: sizes each day's slots to the selected service's duration.
  serviceId: z.string().uuid().optional(),
})

function formatYMD(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl

  const parsed = monthAvailabilitySchema.safeParse({
    artistId: searchParams.get('artistId') ?? '',
    year: searchParams.get('year') ?? '',
    month: searchParams.get('month') ?? '',
    serviceId: searchParams.get('serviceId') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { artistId, year, month, serviceId } = parsed.data
  const month0 = month - 1

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

  // Resolve slot length (service duration when chosen) and buffer once, up front,
  // so the per-day fan-out below doesn't re-query them 28–31 times.
  let durationHours = CONSULTATION_DURATION_HOURS
  if (serviceId) {
    const { data: svc } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', serviceId)
      .eq('artist_id', artistId)
      .eq('active', true)
      .maybeSingle()
    if (svc?.duration_minutes) durationHours = svc.duration_minutes / 60
  }
  const bufferMinutes = await getArtistBufferMinutes(supabase, artistId)

  const daysInMonth = new Date(year, month0 + 1, 0).getDate()

  // Compare against today at UTC midnight; past days are never available.
  const todayStr = new Date().toISOString().slice(0, 10)

  const dates: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(formatYMD(year, month0, day))
  }

  const availability: Record<string, boolean> = {}

  await Promise.all(
    dates.map(async (dateStr) => {
      if (dateStr < todayStr) {
        availability[dateStr] = false
        return
      }
      const { slots } = await getConsultationSlotsForDate(
        supabase,
        artistId,
        dateStr,
        durationHours,
        bufferMinutes,
      )
      availability[dateStr] = slots.some((s) => s.available)
    }),
  )

  return NextResponse.json({ availability })
}
