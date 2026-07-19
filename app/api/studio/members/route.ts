import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveStudioMembership, getUserPlan } from '@/lib/studio/access'
import { sendStudioInvite } from '@/lib/resend/send'
import { getAppUrl } from '@/lib/app-url'

// Uses the service-role admin client with explicit ownership checks; Node runtime.
export const runtime = 'nodejs'

interface MemberDTO {
  id: string
  role: string
  status: string
  invitedEmail: string | null
  artistId: string | null
  displayName: string | null
  // Financial terms are owner-only; null for non-owner viewers.
  commissionRatePct: number | null
  boothRentPence: number | null
}

// ── Shared: resolve the caller's studio + role ────────────────────────────────
type MembershipContext =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; membership: NonNullable<Awaited<ReturnType<typeof resolveStudioMembership>>> }

async function requireMembership(): Promise<MembershipContext> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  }
  const membership = await resolveStudioMembership(user.id)
  if (!membership) {
    return { ok: false, response: NextResponse.json({ error: 'No studio found for this account.' }, { status: 404 }) }
  }
  return { ok: true, userId: user.id, membership }
}

// Owner-only mutations additionally require an ACTIVE Studio plan — plan is not a
// one-time create-snapshot; a downgraded owner must lose management powers.
async function requireOwnerOnPlan(ctx: Extract<MembershipContext, { ok: true }>): Promise<NextResponse | null> {
  if (ctx.membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the studio owner can manage members.' }, { status: 403 })
  }
  const plan = await getUserPlan(ctx.userId)
  if (plan !== 'studio') {
    return NextResponse.json(
      { error: 'Managing studio members requires an active Studio plan.', requiredPlan: 'studio', upgradeUrl: '/dashboard/settings/billing' },
      { status: 403 },
    )
  }
  return null
}

// ── GET: list members of the caller's studio ──────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const ctx = await requireMembership()
  if (!ctx.ok) return ctx.response
  const { membership } = ctx
  const isOwner = membership.role === 'owner'

  const admin = createSupabaseAdminClient()
  const { data: members } = await admin
    .from('studio_members')
    .select('id, role, status, invited_email, artist_id, commission_rate_pct, booth_rent_pence')
    .eq('studio_id', membership.studioId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true })

  const rows = members ?? []

  // Resolve display names for linked artists.
  const artistIds = rows.map((r) => r.artist_id).filter((v): v is string => Boolean(v))
  const nameById = new Map<string, string>()
  if (artistIds.length > 0) {
    const { data: artists } = await admin
      .from('artists')
      .select('id, display_name, username')
      .in('id', artistIds)
    for (const a of artists ?? []) {
      nameById.set(a.id as string, (a.display_name as string | null) ?? (a.username as string))
    }
  }

  const dto: MemberDTO[] = rows.map((r) => ({
    id: r.id as string,
    role: r.role as string,
    status: r.status as string,
    invitedEmail: (r.invited_email as string | null) ?? null,
    artistId: (r.artist_id as string | null) ?? null,
    displayName: r.artist_id ? nameById.get(r.artist_id as string) ?? null : null,
    // Hide financial terms from non-owners.
    commissionRatePct: isOwner ? ((r.commission_rate_pct as number | null) ?? null) : null,
    boothRentPence: isOwner ? ((r.booth_rent_pence as number | null) ?? null) : null,
  }))

  return NextResponse.json({ members: dto, role: membership.role })
}

// ── POST: invite by email, or link an existing artist (owner only) ────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await requireMembership()
  if (!ctx.ok) return ctx.response
  const { membership } = ctx
  const planError = await requireOwnerOnPlan(ctx)
  if (planError) return planError

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown
    artistId?: unknown
    role?: unknown
  }
  const role = body.role === 'front_desk' ? 'front_desk' : 'artist'
  const admin = createSupabaseAdminClient()

  // Resolve the invite target's email. Two entry points, but BOTH create an
  // 'invited' row that the target must accept — an owner can never force an
  // artist into their studio (or levy a commission on them) without consent.
  //   Path A: link an existing artist → invite that artist's ACCOUNT email.
  //   Path B: invite a raw email (no account yet).
  let email: string | null = null
  let linkedArtistId: string | null = null

  if (typeof body.artistId === 'string' && body.artistId) {
    const { data: artist } = await admin
      .from('artists')
      .select('id, user_id, studio_id')
      .eq('id', body.artistId)
      .maybeSingle()
    if (!artist) {
      return NextResponse.json({ error: 'Artist not found.' }, { status: 404 })
    }
    if (artist.studio_id && artist.studio_id !== membership.studioId) {
      return NextResponse.json({ error: 'That artist already belongs to another studio.' }, { status: 409 })
    }
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', artist.user_id)
      .maybeSingle()
    email = (profile?.email as string | null)?.trim().toLowerCase() ?? null
    linkedArtistId = artist.id as string
    if (!email) {
      return NextResponse.json({ error: "Could not resolve that artist's email to send an invite." }, { status: 422 })
    }
  } else if (typeof body.email === 'string' && body.email.includes('@')) {
    email = body.email.trim().toLowerCase()
  }

  if (email) {
    // 14-day invite window.
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: member, error: insertError } = await admin
      .from('studio_members')
      .insert({
        studio_id: membership.studioId,
        role,
        status: 'invited',
        invited_email: email,
        invite_expires_at: expiresAt,
        // Pre-link the artist (Path A) so acceptance attaches the right profile;
        // null for a raw-email invite (Path B).
        artist_id: linkedArtistId,
      })
      // invite_token is DB-defaulted (migration 030); select it back for the link.
      .select('id, invite_token')
      .single()

    if (insertError || !member) {
      console.error('[studio] invite error:', insertError?.message)
      return NextResponse.json({ error: 'Could not create the invite.' }, { status: 500 })
    }

    // ── Send the invite email (non-fatal: the invite row already exists) ──
    let emailSent = false
    try {
      const roleLabel = role === 'front_desk' ? 'front-desk staff' : 'an artist'
      const acceptUrl = `${getAppUrl()}/studio/accept?token=${member.invite_token as string}`

      // Best-effort inviter name (studio owner) for the email copy.
      let inviterName: string | null = null
      const { data: ownerArtist } = await admin
        .from('artists')
        .select('display_name, username')
        .eq('user_id', membership.studio.ownerUserId)
        .maybeSingle()
      if (ownerArtist) {
        inviterName =
          (ownerArtist.display_name as string | null) ??
          (ownerArtist.username as string | null) ??
          null
      }

      const result = await sendStudioInvite(admin, {
        to: email,
        studioName: membership.studio.name,
        inviterName,
        roleLabel,
        acceptUrl,
      })
      emailSent = result.success
    } catch (err) {
      // Swallow — the invite is recorded; the owner can re-send if needed.
      console.error(
        '[studio] invite email failed:',
        err instanceof Error ? err.message : err,
      )
    }

    return NextResponse.json({ memberId: member.id, status: 'invited', emailSent })
  }

  return NextResponse.json({ error: 'Provide an email to invite, or an artistId to link.' }, { status: 400 })
}

// ── PATCH: update a member's role / commission / booth rent (owner only) ──────
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const ctx = await requireMembership()
  if (!ctx.ok) return ctx.response
  const { membership } = ctx
  const planError = await requireOwnerOnPlan(ctx)
  if (planError) return planError

  const body = (await request.json().catch(() => ({}))) as {
    memberId?: unknown
    role?: unknown
    commissionRatePct?: unknown
    boothRentPence?: unknown
  }
  if (typeof body.memberId !== 'string' || !body.memberId) {
    return NextResponse.json({ error: 'memberId is required.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (body.role === 'artist' || body.role === 'front_desk') {
    update.role = body.role
  }
  if (body.commissionRatePct === null) {
    update.commission_rate_pct = null
  } else if (typeof body.commissionRatePct === 'number') {
    const pct = body.commissionRatePct
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'commissionRatePct must be 0–100.' }, { status: 400 })
    }
    update.commission_rate_pct = pct
  }
  if (body.boothRentPence === null) {
    update.booth_rent_pence = null
  } else if (typeof body.boothRentPence === 'number') {
    const pence = Math.round(body.boothRentPence)
    if (!Number.isFinite(pence) || pence < 0) {
      return NextResponse.json({ error: 'boothRentPence must be ≥ 0.' }, { status: 400 })
    }
    update.booth_rent_pence = pence
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  // Scope the update to THIS studio — explicit tenant check, never trust the id alone.
  const { error: updateError } = await admin
    .from('studio_members')
    .update(update)
    .eq('id', body.memberId)
    .eq('studio_id', membership.studioId)

  if (updateError) {
    console.error('[studio] member patch error:', updateError.message)
    return NextResponse.json({ error: 'Could not update member.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE: remove a member (owner only, soft — status='removed') ─────────────
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await requireMembership()
  if (!ctx.ok) return ctx.response
  const { membership } = ctx
  const planError = await requireOwnerOnPlan(ctx)
  if (planError) return planError

  const memberId = new URL(request.url).searchParams.get('id')
  if (!memberId) {
    return NextResponse.json({ error: 'id query param is required.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  const { data: member } = await admin
    .from('studio_members')
    .select('id, role, artist_id')
    .eq('id', memberId)
    .eq('studio_id', membership.studioId)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
  }
  if (member.role === 'owner') {
    return NextResponse.json({ error: 'The studio owner cannot be removed.' }, { status: 400 })
  }

  const { error: removeError } = await admin
    .from('studio_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('studio_id', membership.studioId)

  if (removeError) {
    console.error('[studio] member delete error:', removeError.message)
    return NextResponse.json({ error: 'Could not remove member.' }, { status: 500 })
  }

  // Detach the artist from the studio (their own per-artist data is untouched).
  if (member.artist_id) {
    await admin
      .from('artists')
      .update({ studio_id: null })
      .eq('id', member.artist_id)
      .eq('studio_id', membership.studioId)
  }

  return NextResponse.json({ success: true })
}
