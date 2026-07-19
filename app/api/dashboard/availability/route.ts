import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

// ---------------------------------------------------------------------------
// Availability management: multiple windows per weekday + buffer/setup time,
// plus the artist's read-only iCal feed URL. Artist-owned (RLS enforced).
// ---------------------------------------------------------------------------

async function getOwnArtist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<{ id: string; buffer_minutes: number; calendar_feed_token: string | null } | null> {
  const { data } = await supabase
    .from('artists')
    .select('id, buffer_minutes, calendar_feed_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    buffer_minutes: (data.buffer_minutes as number) ?? 0,
    calendar_feed_token: (data.calendar_feed_token as string | null) ?? null,
  }
}

async function requireArtist(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Unauthorised', status: 401 as const, artist: null }
  const artist = await getOwnArtist(supabase, user.id)
  if (!artist) return { error: 'Forbidden', status: 403 as const, artist: null }
  return { error: null, status: 200 as const, artist }
}

// ── GET — current windows + buffer + iCal feed URL ──────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { error, status, artist } = await requireArtist(supabase)
  if (!artist) return NextResponse.json({ error }, { status })

  const { data: rows } = await supabase
    .from('artist_availability')
    .select('id, day_of_week, start_time, end_time')
    .eq('artist_id', artist.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  const windows = (rows ?? []).map((r) => ({
    id: r.id as string,
    dayOfWeek: r.day_of_week as number,
    startTime: (r.start_time as string).slice(0, 5),
    endTime: (r.end_time as string).slice(0, 5),
  }))

  const feedUrl = artist.calendar_feed_token
    ? `${getAppUrl()}/api/calendar/${artist.calendar_feed_token}`
    : null

  return NextResponse.json({
    windows,
    bufferMinutes: artist.buffer_minutes,
    feedUrl,
  })
}

// ── PUT — replace the full window set and/or buffer minutes ─────────────────

const windowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  })
  .refine((w) => w.endTime > w.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })

const putSchema = z.object({
  windows: z.array(windowSchema).max(50).optional(),
  bufferMinutes: z.number().int().min(0).max(240).optional(),
})

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { error, status, artist } = await requireArtist(supabase)
  if (!artist) return NextResponse.json({ error }, { status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { windows, bufferMinutes } = parsed.data

  if (bufferMinutes !== undefined) {
    const { error: bufErr } = await supabase
      .from('artists')
      .update({ buffer_minutes: bufferMinutes })
      .eq('id', artist.id)
    if (bufErr) {
      console.error('[api/availability] buffer update failed:', bufErr)
      return NextResponse.json({ error: 'Failed to save buffer' }, { status: 500 })
    }
  }

  if (windows !== undefined) {
    // Replace the whole set (delete-all + insert), mirroring settings route.
    const { error: delErr } = await supabase
      .from('artist_availability')
      .delete()
      .eq('artist_id', artist.id)
    if (delErr) {
      console.error('[api/availability] delete failed:', delErr)
      return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 })
    }

    if (windows.length > 0) {
      const { error: insErr } = await supabase.from('artist_availability').insert(
        windows.map((w) => ({
          artist_id: artist.id,
          day_of_week: w.dayOfWeek,
          start_time: `${w.startTime}:00`,
          end_time: `${w.endTime}:00`,
        })),
      )
      if (insErr) {
        console.error('[api/availability] insert failed:', insErr)
        return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
