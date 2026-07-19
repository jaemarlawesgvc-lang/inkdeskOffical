import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { checkAvailabilitySchema } from '@/lib/validations/booking'
import {
  getConsultationSlotsForDate,
  getArtistBufferMinutes,
} from '@/lib/booking/consultation-slots'
import { CONSULTATION_DURATION_HOURS } from '@/lib/constants'
import { z } from 'zod'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl

  const parsed = checkAvailabilitySchema.safeParse({
    artistId: searchParams.get('artistId') ?? '',
    date: searchParams.get('date') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { slots: [], error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  // Optional service selection — determines the slot length when present.
  const serviceIdRaw = searchParams.get('serviceId')
  const serviceId = serviceIdRaw ? z.string().uuid().safeParse(serviceIdRaw) : null
  if (serviceIdRaw && (!serviceId || !serviceId.success)) {
    return NextResponse.json({ slots: [], error: 'Invalid serviceId' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, onboarding_complete')
    .eq('id', parsed.data.artistId)
    .is('deleted_at', null)
    .single()

  if (!artist || !artist.onboarding_complete) {
    return NextResponse.json({ slots: [], error: 'Artist not found' }, { status: 404 })
  }

  // Slot length: the selected service's duration, else the consultation default.
  let durationHours = CONSULTATION_DURATION_HOURS
  let service: { id: string; name: string; duration_minutes: number } | null = null
  if (serviceId && serviceId.success) {
    const { data: svc } = await supabase
      .from('services')
      .select('id, name, duration_minutes, active')
      .eq('id', serviceId.data)
      .eq('artist_id', parsed.data.artistId)
      .eq('active', true)
      .maybeSingle()
    if (!svc) {
      return NextResponse.json({ slots: [], error: 'Service not found' }, { status: 404 })
    }
    service = { id: svc.id, name: svc.name, duration_minutes: svc.duration_minutes }
    durationHours = svc.duration_minutes / 60
  }

  const bufferMinutes = await getArtistBufferMinutes(supabase, parsed.data.artistId)

  const { slots, reason } = await getConsultationSlotsForDate(
    supabase,
    parsed.data.artistId,
    parsed.data.date,
    durationHours,
    bufferMinutes,
  )

  return NextResponse.json({
    slots,
    durationHours,
    bufferMinutes,
    service,
    reason,
    availableCount: slots.filter((s) => s.available).length,
  })
}
