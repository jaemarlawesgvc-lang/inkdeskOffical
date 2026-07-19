/**
 * lib/studio/access.ts  — SERVER ONLY
 *
 * Authorisation helpers for the studio (multi-artist) layer.
 *
 * These mirror the existing admin-route pattern: they use the service-role
 * admin client (RLS bypassed) and perform EXPLICIT membership checks in
 * application code. This keeps the studio layer additive and avoids leaning on
 * new RLS predicates for the primary authorisation gate (the RLS in migration
 * 028 is a defence-in-depth backstop). Never import this into client code.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveActivePlan, type Plan } from '@/lib/stripe/plans'

export type StudioRole = 'owner' | 'artist' | 'front_desk'

export interface StudioSummary {
  id: string
  name: string
  slug: string
  ownerUserId: string
}

export interface StudioMembership {
  studioId: string
  role: StudioRole
  studio: StudioSummary
}

function toStudioSummary(row: {
  id: string
  name: string
  slug: string
  owner_user_id: string
}): StudioSummary {
  return { id: row.id, name: row.name, slug: row.slug, ownerUserId: row.owner_user_id }
}

/**
 * Resolve the studio a user belongs to, and their role within it.
 *
 * Precedence: if the user OWNS a studio they are its 'owner'. Otherwise, if
 * they are an ACTIVE member of a studio, their membership role is returned.
 * Returns null for a solo artist with no studio affiliation.
 */
export async function resolveStudioMembership(
  userId: string,
): Promise<StudioMembership | null> {
  const admin = createSupabaseAdminClient()

  // 1. Owner takes precedence.
  const { data: owned } = await admin
    .from('studios')
    .select('id, name, slug, owner_user_id')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (owned) {
    return { studioId: owned.id, role: 'owner', studio: toStudioSummary(owned) }
  }

  // 2. Active membership. Use order+limit(1) rather than maybeSingle: if a user
  // somehow ends up active in two studios, maybeSingle THROWS and locks them out
  // of both. Deterministically pick their earliest membership instead.
  const { data: memberships } = await admin
    .from('studio_members')
    .select('studio_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)

  const membership = memberships?.[0]
  if (!membership) return null

  const { data: studio } = await admin
    .from('studios')
    .select('id, name, slug, owner_user_id')
    .eq('id', membership.studio_id)
    .maybeSingle()

  if (!studio) return null

  return {
    studioId: studio.id,
    role: (membership.role as StudioRole) ?? 'artist',
    studio: toStudioSummary(studio),
  }
}

/**
 * Return true iff the given user owns the given studio.
 */
export async function assertStudioOwner(
  userId: string,
  studioId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('studios')
    .select('id')
    .eq('id', studioId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Collect the artist ids that belong to a studio.
 *
 * Union of two sources:
 *   • active studio_members rows that carry an artist_id
 *   • artists whose artists.studio_id points at this studio
 *
 * This is the audience for the shared calendar feed and the earnings ledger.
 */
export async function getStudioMemberArtistIds(studioId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient()
  const ids = new Set<string>()

  const { data: members } = await admin
    .from('studio_members')
    .select('artist_id')
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .not('artist_id', 'is', null)

  for (const m of members ?? []) {
    if (m.artist_id) ids.add(m.artist_id as string)
  }

  const { data: artists } = await admin
    .from('artists')
    .select('id')
    .eq('studio_id', studioId)

  for (const a of artists ?? []) {
    ids.add(a.id as string)
  }

  return [...ids]
}

/**
 * Resolve a user's active subscription plan via the service-role client.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  return resolveActivePlan(data ?? null)
}

/**
 * A pending (or already-accepted) studio invite, resolved by its opaque token.
 * Carries just enough to render the accept page and to gate acceptance.
 */
export interface StudioInvite {
  memberId: string
  studioId: string
  studioName: string
  studioSlug: string
  role: StudioRole
  status: 'invited' | 'active' | 'removed'
  invitedEmail: string | null
  /** Display name of the studio owner who sent the invite, if resolvable. */
  inviterName: string | null
  expiresAt: string | null
  /** True iff invite_expires_at is set and in the past. */
  isExpired: boolean
}

/**
 * Resolve an invite by its opaque token (service-role; RLS bypassed).
 *
 * Returns null only when no membership row carries the token. Expiry and
 * email-match are NOT enforced here — they are surfaced (isExpired) or left to
 * the caller so the accept page can show precise, distinct errors.
 */
export async function resolveInviteByToken(token: string): Promise<StudioInvite | null> {
  const admin = createSupabaseAdminClient()

  const { data: member } = await admin
    .from('studio_members')
    .select('id, studio_id, role, status, invited_email, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!member) return null

  const { data: studio } = await admin
    .from('studios')
    .select('id, name, slug, owner_user_id')
    .eq('id', member.studio_id as string)
    .maybeSingle()

  if (!studio) return null

  // Resolve the inviter's (owner's) display name — best effort, never fatal.
  let inviterName: string | null = null
  const { data: ownerArtist } = await admin
    .from('artists')
    .select('display_name, username')
    .eq('user_id', studio.owner_user_id as string)
    .maybeSingle()
  if (ownerArtist) {
    inviterName =
      (ownerArtist.display_name as string | null) ??
      (ownerArtist.username as string | null) ??
      null
  }

  const expiresAt = (member.invite_expires_at as string | null) ?? null
  const isExpired = expiresAt !== null && new Date(expiresAt).getTime() < Date.now()

  return {
    memberId: member.id as string,
    studioId: studio.id as string,
    studioName: studio.name as string,
    studioSlug: studio.slug as string,
    role: (member.role as StudioRole) ?? 'artist',
    status: (member.status as 'invited' | 'active' | 'removed') ?? 'invited',
    invitedEmail: (member.invited_email as string | null) ?? null,
    inviterName,
    expiresAt,
    isExpired,
  }
}

/**
 * Turn a studio name into a URL-safe slug candidate.
 */
export function slugifyStudioName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return base.length >= 2 ? base : 'studio'
}

/**
 * Studio-commission context for a studio-affiliated artist whose studio is
 * ready to receive automated commission payouts.
 */
export interface StudioCommissionContext {
  studioId: string
  studioConnectAccountId: string
  commissionRatePct: number
}

/**
 * Resolve whether a deposit/balance for the given artist should carry a studio
 * commission — and if so, where it goes.
 *
 * Returns a context ONLY when ALL of these hold:
 *   • the artist is an ACTIVE member of a studio with a commission_rate_pct > 0
 *   • that studio has a connected Stripe account (stripe_connect_account_id)
 *   • that account is fully onboarded (stripe_connect_status = 'verified')
 *
 * Returns null for a solo artist, an artist with no commission rate, or a
 * studio whose payouts are not yet set up — in every such case the caller must
 * leave the PaymentIntent UNCHANGED (no application fee, no transfer), keeping
 * the solo-artist flow byte-for-byte identical.
 */
export async function resolveStudioCommissionForArtist(
  artistId: string,
): Promise<StudioCommissionContext | null> {
  const admin = createSupabaseAdminClient()

  const { data: members } = await admin
    .from('studio_members')
    .select('studio_id, commission_rate_pct')
    .eq('artist_id', artistId)
    .eq('status', 'active')
    .not('commission_rate_pct', 'is', null)
    .gt('commission_rate_pct', 0)
    .limit(1)

  const member = members?.[0]
  if (!member || !member.studio_id) return null

  const pct = Number(member.commission_rate_pct)
  if (!Number.isFinite(pct) || pct <= 0) return null

  const { data: studio } = await admin
    .from('studios')
    .select('id, owner_user_id, stripe_connect_account_id, stripe_connect_status')
    .eq('id', member.studio_id)
    .maybeSingle()

  if (
    !studio ||
    !studio.stripe_connect_account_id ||
    studio.stripe_connect_status !== 'verified'
  ) {
    return null
  }

  // Commission is a paid (Studio-plan) capability. If the owner has downgraded,
  // stop levying it — otherwise a lapsed owner keeps skimming member income.
  const ownerPlan = await getUserPlan(studio.owner_user_id as string)
  if (ownerPlan !== 'studio') return null

  return {
    studioId: studio.id,
    studioConnectAccountId: studio.stripe_connect_account_id,
    commissionRatePct: pct,
  }
}

/**
 * The application fee (studio commission), in integer pence, for a charged
 * amount. Computed on the CHARGED amount — i.e. AFTER any gift-card reduction.
 * Returns 0 for a non-positive charge or rate.
 */
export function computeCommissionFeePence(chargedPence: number, pct: number): number {
  if (chargedPence <= 0 || pct <= 0) return 0
  return Math.round(chargedPence * (pct / 100))
}
