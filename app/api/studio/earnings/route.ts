import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveStudioMembership } from '@/lib/studio/access'
import { computeStudioLedger, type MemberFinancialInput } from '@/lib/studio/earnings'

// Service-role admin client + explicit OWNER check; Node runtime.
export const runtime = 'nodejs'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  REPORTING ONLY — moves NO money and does NOT call Stripe.                  │
 * │                                                                            │
 * │  Automated commission/booth-rent settlement would require a multi-account  │
 * │  Stripe Connect topology (separate charges + transfers between the         │
 * │  studio's and each artist's connected accounts). The existing payment      │
 * │  flows send funds straight to the individual artist's connected account    │
 * │  with no platform commission, so there is no money for the studio to route │
 * │  automatically. That settlement work is out of scope for this foundation.  │
 * │  This endpoint only computes what each artist NOTIONALLY owes the studio.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

// Best available integer-pence value for a booking's service total.
function bookingServicePence(b: {
  total_amount_pence: number | null
  total_amount: number | null
  deposit_amount: number | null
}): number {
  if (typeof b.total_amount_pence === 'number' && b.total_amount_pence > 0) {
    return b.total_amount_pence
  }
  if (typeof b.total_amount === 'number' && b.total_amount > 0) {
    return Math.round(b.total_amount * 100)
  }
  if (typeof b.deposit_amount === 'number' && b.deposit_amount > 0) {
    return Math.round(b.deposit_amount * 100)
  }
  return 0
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const membership = await resolveStudioMembership(user.id)
  if (!membership) {
    return NextResponse.json({ error: 'No studio found for this account.' }, { status: 404 })
  }
  // The owed ledger exposes every member's revenue — owner-only.
  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the studio owner can view earnings.' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const fallback = defaultRange()
  const from = ISO_DATE_RE.test(params.get('from') ?? '') ? (params.get('from') as string) : fallback.from
  const to = ISO_DATE_RE.test(params.get('to') ?? '') ? (params.get('to') as string) : fallback.to

  const admin = createSupabaseAdminClient()

  // Roster: active members that carry an artist_id (the ones with terms set).
  const { data: members } = await admin
    .from('studio_members')
    .select('artist_id, role, commission_rate_pct, booth_rent_pence')
    .eq('studio_id', membership.studioId)
    .eq('status', 'active')
    .not('artist_id', 'is', null)

  const roster = (members ?? []).filter((m) => m.artist_id)
  if (roster.length === 0) {
    return NextResponse.json({ from, to, ledger: { rows: [], totals: null } })
  }

  const artistIds = roster.map((m) => m.artist_id as string)

  // Display names.
  const nameById = new Map<string, string>()
  const { data: artists } = await admin
    .from('artists')
    .select('id, display_name, username')
    .in('id', artistIds)
  for (const a of artists ?? []) {
    nameById.set(a.id as string, (a.display_name as string | null) ?? (a.username as string))
  }

  // Service revenue per artist over the period (paid/booked, occupying statuses).
  const revenueById = new Map<string, number>()
  const { data: bookings } = await admin
    .from('bookings')
    .select('artist_id, total_amount_pence, total_amount, deposit_amount, booking_date, status')
    .in('artist_id', artistIds)
    .is('deleted_at', null)
    .gte('booking_date', from)
    .lte('booking_date', to)
    .in('status', ['confirmed', 'deposit_paid', 'completed'])
  for (const b of bookings ?? []) {
    const pence = bookingServicePence({
      total_amount_pence: (b.total_amount_pence as number | null) ?? null,
      total_amount: (b.total_amount as number | null) ?? null,
      deposit_amount: (b.deposit_amount as number | null) ?? null,
    })
    const id = b.artist_id as string
    revenueById.set(id, (revenueById.get(id) ?? 0) + pence)
  }

  // Tips per artist over the period.
  const tipsById = new Map<string, number>()
  const { data: tips } = await admin
    .from('tips')
    .select('artist_id, amount_pence, created_at')
    .in('artist_id', artistIds)
    .gte('created_at', `${from}T00:00:00Z`)
    .lte('created_at', `${to}T23:59:59Z`)
  for (const t of tips ?? []) {
    const id = t.artist_id as string
    tipsById.set(id, (tipsById.get(id) ?? 0) + (t.amount_pence as number))
  }

  const inputs: MemberFinancialInput[] = roster.map((m) => {
    const artistId = m.artist_id as string
    return {
      artistId,
      displayName: nameById.get(artistId) ?? 'Artist',
      role: m.role as string,
      commissionRatePct: (m.commission_rate_pct as number | null) ?? null,
      boothRentPence: (m.booth_rent_pence as number | null) ?? null,
      serviceRevenuePence: revenueById.get(artistId) ?? 0,
      tipsPence: tipsById.get(artistId) ?? 0,
    }
  })

  const ledger = computeStudioLedger(inputs)

  return NextResponse.json({
    from,
    to,
    reportingOnly: true,
    ledger,
  })
}
