import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Credentials API
//
// Writes go through the service-role (admin) client so they are reliable even
// if the artist_credentials RLS policy is missing/outdated on the live DB
// (the in-browser insert was failing with "new row violates row-level
// security policy"). Ownership is verified with the user-scoped session client
// FIRST, so the elevated write only ever touches the caller's own artist.
// ---------------------------------------------------------------------------

async function getOwnArtistId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<string | null> {
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', userId)
    .single()
  return artist?.id ?? null
}

const createSchema = z.object({
  type: z.enum(['license', 'award', 'publication']),
  title: z.string().min(1).max(200).trim(),
  issuingBody: z.string().max(200).trim().nullable().optional(),
  year: z.number().int().min(0).max(9999).nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
  storagePath: z.string().max(500).nullable().optional(),
})

// ── POST — create a credential ───────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const { type, title, issuingBody, year, url, storagePath } = parsed.data

  // Service-role write — bypasses RLS, scoped to the verified artist.
  const admin = createSupabaseAdminClient()
  const { data: row, error } = await admin
    .from('artist_credentials')
    .insert({
      artist_id: artistId,
      type,
      title,
      issuing_body: issuingBody ?? null,
      year: year ?? null,
      url: url ?? null,
      storage_path: storagePath ?? null,
    })
    .select('id, type, title, issuing_body, year, expiry_date, url, storage_path')
    .single()

  if (error || !row) {
    console.error('[api/credentials] create failed:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to save credential' },
      { status: 500 },
    )
  }

  return NextResponse.json({ credential: row })
}

// ── DELETE — remove a credential (?id=) + its stored file ────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 422 })
  }

  const admin = createSupabaseAdminClient()

  // Fetch first so we can (a) verify ownership and (b) clean up storage.
  const { data: cred } = await admin
    .from('artist_credentials')
    .select('id, artist_id, storage_path')
    .eq('id', parsedId.data)
    .maybeSingle()

  if (!cred || cred.artist_id !== artistId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('artist_credentials')
    .delete()
    .eq('id', parsedId.data)

  if (error) {
    console.error('[api/credentials] delete failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (cred.storage_path) {
    await admin.storage.from('credentials').remove([cred.storage_path])
  }

  return NextResponse.json({ ok: true })
}
