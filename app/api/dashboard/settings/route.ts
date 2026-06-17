import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  artistId: z.string().uuid(),
  displayName: z.string().min(1).max(100).trim(),
  bio: z.string().max(500).trim(),
  styleTags: z.array(z.string()).max(10),
  instagramHandle: z.string().max(30).trim(),
  studioName: z.string().max(200).trim(),
  studioAddress: z.string().max(500).trim(),
  hourlyRate: z.number().positive().max(9999.99).nullable().optional(),
  depositAmount: z.number().positive().max(9999.99).nullable().optional(),
  depositRequired: z.boolean(),
  pricingNotes: z.string().max(1000).trim(),
  timezone: z.string().min(1),
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
  emailBookingConfirmation: z.boolean(),
  emailReminders: z.boolean(),
  emailAftercare: z.boolean(),
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

  // Update artist profile + pricing
  const { error: artistError } = await supabase
    .from('artists')
    .update({
      display_name: d.displayName,
      bio: d.bio,
      style_tags: d.styleTags,
      instagram_handle: d.instagramHandle,
      studio_name: d.studioName || null,
      studio_address: d.studioAddress || null,
      hourly_rate: d.hourlyRate ?? null,
      deposit_amount: d.depositAmount ?? null,
      deposit_required: d.depositRequired,
      pricing_notes: d.pricingNotes || null,
      email_booking_confirmation: d.emailBookingConfirmation,
      email_reminders: d.emailReminders,
      email_aftercare: d.emailAftercare,
      updated_at: now,
    })
    .eq('id', d.artistId)

  if (artistError) {
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  // Resync availability slots
  await supabase.from('artist_availability').delete().eq('artist_id', d.artistId)

  if (d.availability.length > 0) {
    const { error: availError } = await supabase.from('artist_availability').insert(
      d.availability.map((s) => ({
        artist_id: d.artistId,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        timezone: d.timezone,
      })),
    )
    if (availError) {
      return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
