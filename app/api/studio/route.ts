import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  resolveStudioMembership,
  getUserPlan,
  slugifyStudioName,
} from '@/lib/studio/access'

// Uses the service-role admin client; pin to Node (not Edge).
export const runtime = 'nodejs'

// ── GET: the current user's studio (as owner or active member), or null ───────
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const membership = await resolveStudioMembership(user.id)
  if (!membership) {
    return NextResponse.json({ studio: null, role: null })
  }

  return NextResponse.json({
    studio: membership.studio,
    role: membership.role,
  })
}

// ── POST: create a studio (Studio plan only, one per owner) ───────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Plan gate — creating/running a studio is a Studio-plan capability.
  const plan = await getUserPlan(user.id)
  if (plan !== 'studio') {
    return NextResponse.json(
      {
        error: 'Creating a studio requires a Studio plan.',
        currentPlan: plan,
        requiredPlan: 'studio',
        upgradeUrl: '/dashboard/settings/billing',
      },
      { status: 403 },
    )
  }

  // One studio per owner.
  const existing = await resolveStudioMembership(user.id)
  if (existing && existing.role === 'owner') {
    return NextResponse.json(
      { error: 'You already own a studio.', studio: existing.studio },
      { status: 409 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'A studio name (1–120 chars) is required.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // Derive a unique slug: base candidate, then suffix on collision.
  const baseSlug = slugifyStudioName(name)
  let slug = baseSlug
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await admin
      .from('studios')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!clash) break
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: studio, error: insertError } = await admin
    .from('studios')
    .insert({ owner_user_id: user.id, name, slug })
    .select('id, name, slug, owner_user_id')
    .single()

  if (insertError || !studio) {
    console.error('[studio] create error:', insertError?.message)
    return NextResponse.json({ error: 'Could not create studio.' }, { status: 500 })
  }

  // Record the owner as a member row too (role 'owner', active). Best-effort:
  // if the owner has an artist record, link it so their bookings/earnings appear.
  const { data: ownerArtist } = await admin
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  await admin.from('studio_members').insert({
    studio_id: studio.id,
    user_id: user.id,
    artist_id: ownerArtist?.id ?? null,
    role: 'owner',
    status: 'active',
  })

  if (ownerArtist?.id) {
    await admin.from('artists').update({ studio_id: studio.id }).eq('id', ownerArtist.id)
  }

  return NextResponse.json({
    studio: {
      id: studio.id,
      name: studio.name,
      slug: studio.slug,
      ownerUserId: studio.owner_user_id,
    },
    role: 'owner',
  })
}
