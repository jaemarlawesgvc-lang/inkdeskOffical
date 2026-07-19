import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Services CRUD — per-artist bookable services (name / duration / price /
// active). Artist-owned; RLS enforces ownership, ownership is re-checked here
// on writes via .eq('artist_id', …), mirroring the FAQ route pattern.
// ---------------------------------------------------------------------------

async function getOwnArtistId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.id as string) ?? null
}

async function requireArtistId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ artistId: string | null; error: string | null; status: 401 | 403 | 200 }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { artistId: null, error: 'Unauthorised', status: 401 }
  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return { artistId: null, error: 'Forbidden', status: 403 }
  return { artistId, error: null, status: 200 }
}

function serialize(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    durationMinutes: row.duration_minutes as number,
    pricePence: (row.price_pence as number | null) ?? null,
    active: row.active as boolean,
    sortOrder: row.sort_order as number,
  }
}

// ── GET — list the artist's services ────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { artistId, error, status } = await requireArtistId(supabase)
  if (!artistId) return NextResponse.json({ error }, { status })

  const { data } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_pence, active, sort_order')
    .eq('artist_id', artistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return NextResponse.json({ services: (data ?? []).map(serialize) })
}

// ── POST — create a service ─────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  durationMinutes: z.number().int().min(1).max(960),
  pricePence: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { artistId, error, status } = await requireArtistId(supabase)
  if (!artistId) return NextResponse.json({ error }, { status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artistId)

  const { data, error: insErr } = await supabase
    .from('services')
    .insert({
      artist_id: artistId,
      name: parsed.data.name,
      duration_minutes: parsed.data.durationMinutes,
      price_pence: parsed.data.pricePence ?? null,
      active: parsed.data.active ?? true,
      sort_order: count ?? 0,
    })
    .select('id, name, duration_minutes, price_pence, active, sort_order')
    .single()

  if (insErr || !data) {
    console.error('[api/services] create failed:', insErr)
    return NextResponse.json({ error: insErr?.message ?? 'Failed to create service' }, { status: 500 })
  }

  return NextResponse.json({ service: serialize(data) })
}

// ── PATCH — update a service ────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim().optional(),
  durationMinutes: z.number().int().min(1).max(960).optional(),
  pricePence: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { artistId, error, status } = await requireArtistId(supabase)
  if (!artistId) return NextResponse.json({ error }, { status })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { id, name, durationMinutes, pricePence, active, sortOrder } = parsed.data
  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (durationMinutes !== undefined) update.duration_minutes = durationMinutes
  if (pricePence !== undefined) update.price_pence = pricePence
  if (active !== undefined) update.active = active
  if (sortOrder !== undefined) update.sort_order = sortOrder

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })
  }

  const { error: updErr } = await supabase
    .from('services')
    .update(update)
    .eq('id', id)
    .eq('artist_id', artistId)

  if (updErr) {
    console.error('[api/services] update failed:', updErr)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// ── DELETE — remove a service (?id=) ────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { artistId, error, status } = await requireArtistId(supabase)
  if (!artistId) return NextResponse.json({ error }, { status })

  const parsedId = z.string().uuid().safeParse(request.nextUrl.searchParams.get('id'))
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 422 })
  }

  const { error: delErr } = await supabase
    .from('services')
    .delete()
    .eq('id', parsedId.data)
    .eq('artist_id', artistId)

  if (delErr) {
    console.error('[api/services] delete failed:', delErr)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
