import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  artistId: z.string().uuid(),
  displayName: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  styleTags: z.array(z.string()).max(10).optional(),
  instagramHandle: z.string().max(30).trim().optional(),
  studioName: z.string().max(200).trim().optional(),
  studioAddress: z.string().max(500).trim().optional(),
  studioLat: z.number().min(-90).max(90).nullable().optional(),
  studioLng: z.number().min(-180).max(180).nullable().optional(),
  hourlyRate: z.number().nonnegative().max(9999.99).nullable().optional(),
  depositAmount: z.number().nonnegative().max(9999.99).nullable().optional(),
  depositRequired: z.boolean().optional(),
  pricingNotes: z.string().max(1000).trim().optional(),
  priceTier: z.string().optional(),
  timezone: z.string().min(1).optional(),
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ).optional(),
  emailBookingConfirmation: z.boolean().optional(),
  emailReminders: z.boolean().optional(),
  emailAftercare: z.boolean().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const d = parsed.data

  // Verify artist belongs to user
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', d.artistId)
    .eq('user_id', user.id)
    .single()

  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  // Update artist profile + pricing dynamically
  const updatePayload: any = {}
  if (d.displayName !== undefined) updatePayload.display_name = d.displayName
  if (d.bio !== undefined) updatePayload.bio = d.bio
  if (d.styleTags !== undefined) updatePayload.style_tags = d.styleTags
  if (d.instagramHandle !== undefined) updatePayload.instagram_handle = d.instagramHandle
  if (d.studioName !== undefined) updatePayload.studio_name = d.studioName || null
  if (d.studioAddress !== undefined) updatePayload.studio_address = d.studioAddress || null
  if (d.studioLat !== undefined) updatePayload.studio_lat = d.studioLat ?? null
  if (d.studioLng !== undefined) updatePayload.studio_lng = d.studioLng ?? null
  if (d.hourlyRate !== undefined) updatePayload.hourly_rate = d.hourlyRate ?? null
  if (d.depositAmount !== undefined) updatePayload.deposit_amount = d.depositAmount ?? null
  if (d.depositRequired !== undefined) updatePayload.deposit_required = d.depositRequired
  if (d.pricingNotes !== undefined) updatePayload.pricing_notes = d.pricingNotes || null
  if (d.priceTier !== undefined) updatePayload.price_tier = d.priceTier || '££'
  if (d.emailBookingConfirmation !== undefined) updatePayload.email_booking_confirmation = d.emailBookingConfirmation
  if (d.emailReminders !== undefined) updatePayload.email_reminders = d.emailReminders
  if (d.emailAftercare !== undefined) updatePayload.email_aftercare = d.emailAftercare

  let artistError = null
  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updated_at = now
    const { error: updateErr } = await supabase
      .from('artists')
      .update(updatePayload)
      .eq('id', d.artistId)
    artistError = updateErr

    // Graceful fallback if price_tier column doesn't exist yet
    if (artistError && (artistError.message.includes('price_tier') || artistError.code === '42703')) {
      delete updatePayload.price_tier
      const retry = await supabase
        .from('artists')
        .update(updatePayload)
        .eq('id', d.artistId)
      artistError = retry.error
    }
  }

  if (artistError) {
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  // Resync availability slots only if provided in request body
  if (d.availability !== undefined) {
    await supabase.from('artist_availability').delete().eq('artist_id', d.artistId)

    if (d.availability.length > 0) {
      const timezone = d.timezone || 'Europe/London'
      const { error: availError } = await supabase.from('artist_availability').insert(
        d.availability.map((s) => ({
          artist_id: d.artistId,
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
          timezone,
        })),
      )
      if (availError) {
        return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 })
      }
    }
  }
  return NextResponse.json({ ok: true })
}
