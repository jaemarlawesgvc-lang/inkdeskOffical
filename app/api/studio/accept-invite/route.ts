import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'

// Uses the service-role admin client for the write, gated by an explicit
// signed-in-user + token + email-match check. Node runtime.
export const runtime = 'nodejs'

/**
 * POST /api/studio/accept-invite
 *
 * Body: { token: string }
 *
 * The signed-in user accepts a studio invite. We require that:
 *   • the caller is authenticated,
 *   • the token resolves to a membership row,
 *   • the row is still 'invited' (or already 'active' for THIS user → idempotent),
 *   • the invite has not expired,
 *   • invited_email matches the signed-in user's email (case-insensitive).
 *
 * On success we populate the row (user_id, status='active', artist_id) and point
 * the user's artists.studio_id at the studio so they appear in the roster/calendar.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to accept an invite.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { token?: unknown }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'A valid invite token is required.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // ── Look up the invite row by its opaque token ──
  const { data: member } = await admin
    .from('studio_members')
    .select('id, studio_id, user_id, artist_id, role, status, invited_email, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'This invite link is not valid.' }, { status: 404 })
  }

  const studioId = member.studio_id as string
  const currentEmail = (user.email ?? '').trim().toLowerCase()
  const invitedEmail = ((member.invited_email as string | null) ?? '').trim().toLowerCase()

  // ── Idempotency: an already-active row belonging to this user is a success ──
  if (member.status === 'active') {
    if (member.user_id === user.id) {
      return NextResponse.json({ success: true, studioId, alreadyAccepted: true })
    }
    return NextResponse.json({ error: 'This invite has already been accepted.' }, { status: 409 })
  }

  if (member.status === 'removed') {
    return NextResponse.json({ error: 'This invite is no longer available.' }, { status: 410 })
  }

  // ── Expiry ──
  const expiresAt = (member.invite_expires_at as string | null) ?? null
  if (expiresAt !== null && new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This invite has expired. Ask the studio owner to send a new one.' }, { status: 410 })
  }

  // ── Require a verified email — the whole gate rests on email ownership ──
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Please verify your email address before accepting a studio invite.' },
      { status: 403 },
    )
  }

  // ── Email match — the invited address must be the signed-in account ──
  if (!invitedEmail || !currentEmail || invitedEmail !== currentEmail) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${member.invited_email ?? 'a different address'}. Sign in with that email to accept it.`,
      },
      { status: 403 },
    )
  }

  // ── Guard: this user must not already be a member of this studio ──
  // (The (studio_id, user_id) unique constraint would reject the update; catch
  // it early for a clean message.)
  const { data: existing } = await admin
    .from('studio_members')
    .select('id, status')
    .eq('studio_id', studioId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing && existing.id !== member.id) {
    return NextResponse.json({ error: 'You are already a member of this studio.' }, { status: 409 })
  }

  // ── A user may belong to only ONE studio. Block accepting if they're already
  // active elsewhere or own a studio — otherwise resolveStudioMembership can't
  // deterministically pick one and every studio route breaks for them. ──
  const { data: otherActive } = await admin
    .from('studio_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('studio_id', studioId)
    .limit(1)
  if (otherActive && otherActive.length > 0) {
    return NextResponse.json(
      { error: 'You are already an active member of another studio. Leave it before joining a new one.' },
      { status: 409 },
    )
  }
  const { data: owned } = await admin
    .from('studios')
    .select('id')
    .eq('owner_user_id', user.id)
    .limit(1)
  if (owned && owned.length > 0) {
    return NextResponse.json(
      { error: 'You already own a studio, so you cannot also join one as a member.' },
      { status: 409 },
    )
  }

  // ── Resolve the accepting user's artist record, if they have one ──
  const { data: artist } = await admin
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const artistId = (artist?.id as string | undefined) ?? (member.artist_id as string | null) ?? null

  // ── Populate the membership row (optimistic: only claim a still-pending
  //    invite, and confirm a row was actually claimed to avoid false success). ──
  const { data: claimed, error: updateError } = await admin
    .from('studio_members')
    .update({
      user_id: user.id,
      status: 'active',
      artist_id: artistId,
    })
    .eq('id', member.id)
    .eq('status', 'invited')
    .select('id')

  if (updateError) {
    console.error('[studio] accept-invite update error:', updateError.message)
    return NextResponse.json({ error: 'Could not accept the invite. Please try again.' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    // Someone withdrew or accepted it between our SELECT and UPDATE.
    return NextResponse.json(
      { error: 'This invite is no longer available. Ask the studio owner to send a new one.' },
      { status: 409 },
    )
  }

  // ── Link the artist to the studio so they show in the roster/calendar ──
  if (artistId) {
    const { error: artistError } = await admin
      .from('artists')
      .update({ studio_id: studioId })
      .eq('id', artistId)
    if (artistError) {
      // Non-fatal: membership is active; the studio_id link is best-effort.
      console.error('[studio] accept-invite artist link error:', artistError.message)
    }
  }

  return NextResponse.json({ success: true, studioId })
}
