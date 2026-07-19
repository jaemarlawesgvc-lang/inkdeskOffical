import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Multi-session projects — GET list / POST create / PATCH update.
// Artist-owned; ownership verified via getUser + .eq('artist_id', …), matching
// the FAQ / services dashboard routes. RLS also enforces ownership.
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
    clientId: (row.client_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    totalSessions: (row.total_sessions as number | null) ?? null,
    status: row.status as string,
    createdAt: row.created_at as string,
  }
}

const SELECT_COLS = 'id, client_id, title, description, total_sessions, status, created_at'

// ── GET — list the artist's projects ────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { artistId, error, status } = await requireArtistId(supabase)
  if (!artistId) return NextResponse.json({ error }, { status })

  const { data } = await supabase
    .from('booking_projects')
    .select(SELECT_COLS)
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ projects: (data ?? []).map(serialize) })
}

// ── POST — create a project ─────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  clientId: z.string().uuid().nullable().optional(),
  totalSessions: z.number().int().min(1).max(100).nullable().optional(),
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

  // If a client is supplied, confirm it belongs to this artist.
  if (parsed.data.clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.clientId)
      .eq('artist_id', artistId)
      .maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error: insErr } = await supabase
    .from('booking_projects')
    .insert({
      artist_id: artistId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      client_id: parsed.data.clientId ?? null,
      total_sessions: parsed.data.totalSessions ?? null,
    })
    .select(SELECT_COLS)
    .single()

  if (insErr || !data) {
    console.error('[api/projects] create failed:', insErr)
    return NextResponse.json({ error: insErr?.message ?? 'Failed to create project' }, { status: 500 })
  }

  return NextResponse.json({ project: serialize(data) })
}

// ── PATCH — update a project ────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  totalSessions: z.number().int().min(1).max(100).nullable().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
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

  const { id, title, description, clientId, totalSessions, status: newStatus } = parsed.data

  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('artist_id', artistId)
      .maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (title !== undefined) update.title = title
  if (description !== undefined) update.description = description || null
  if (clientId !== undefined) update.client_id = clientId
  if (totalSessions !== undefined) update.total_sessions = totalSessions
  if (newStatus !== undefined) update.status = newStatus

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })
  }

  const { error: updErr } = await supabase
    .from('booking_projects')
    .update(update)
    .eq('id', id)
    .eq('artist_id', artistId)

  if (updErr) {
    console.error('[api/projects] update failed:', updErr)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
