import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { promises as dns } from 'dns'
import { randomBytes } from 'crypto'
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@/lib/supabase/server'
import { resolveActivePlan, PLAN_LIMITS } from '@/lib/stripe/plans'

// Uses node:dns for TXT verification, so pin to the Node runtime (not Edge).
export const runtime = 'nodejs'

// The TXT record host an artist adds to prove domain ownership, and its value.
const TXT_PREFIX = '_inkquire-verify'
const TXT_VALUE_PREFIX = 'inkquire-verification='

// Bare hostname: labels of a-z0-9/hyphen, at least one dot, max 253 chars.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

function normaliseDomain(input: string): string | null {
  let host = input.trim().toLowerCase()
  // Tolerate a pasted URL or a leading www.
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!DOMAIN_RE.test(host)) return null
  return host
}

function appHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function requireStudioArtist() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, username')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return { ok: false as const, response: NextResponse.json({ error: 'Artist not found' }, { status: 404 }) }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  if (!PLAN_LIMITS[plan].customDomain) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Custom domains require a Studio plan.',
          currentPlan: plan,
          requiredPlan: 'studio',
          upgradeUrl: '/dashboard/settings/billing',
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, supabase, user, artist }
}

// GET — current custom-domain state for the signed-in artist.
export async function GET(): Promise<NextResponse> {
  const ctx = await requireStudioArtist()
  if (!ctx.ok) return ctx.response
  const { supabase, artist } = ctx

  const { data: row } = await supabase
    .from('custom_domains')
    .select('domain, verified, verification_token, verified_at')
    .eq('artist_id', artist.id)
    .maybeSingle()

  return NextResponse.json({
    domain: row?.domain ?? null,
    verified: row?.verified ?? false,
    verifiedAt: row?.verified_at ?? null,
    txtRecord: row
      ? { host: `${TXT_PREFIX}.${row.domain}`, value: `${TXT_VALUE_PREFIX}${row.verification_token}` }
      : null,
  })
}

// POST — add (or replace) the domain mapping and issue a fresh verification token.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await requireStudioArtist()
  if (!ctx.ok) return ctx.response
  const { artist } = ctx

  let body: { domain?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.domain !== 'string') {
    return NextResponse.json({ error: 'A domain is required' }, { status: 400 })
  }

  const domain = normaliseDomain(body.domain)
  if (!domain) {
    return NextResponse.json({ error: 'Enter a valid domain, e.g. ink.yourstudio.com' }, { status: 422 })
  }

  if (domain === appHost() || domain.endsWith('.vercel.app')) {
    return NextResponse.json({ error: 'That domain cannot be used.' }, { status: 422 })
  }

  const token = randomBytes(16).toString('hex')

  // Service client: the unique-domain constraint means we upsert on artist_id so
  // an artist can change their domain, always resetting verification.
  const service = createSupabaseServiceClient()

  // Guard against claiming a domain already verified by another artist.
  const { data: existing } = await service
    .from('custom_domains')
    .select('artist_id')
    .eq('domain', domain)
    .maybeSingle()

  if (existing && existing.artist_id !== artist.id) {
    return NextResponse.json({ error: 'That domain is already in use.' }, { status: 409 })
  }

  const { error: upsertError } = await service
    .from('custom_domains')
    .upsert(
      {
        artist_id: artist.id,
        domain,
        verified: false,
        verified_at: null,
        verification_token: token,
      },
      { onConflict: 'artist_id' },
    )

  if (upsertError) {
    console.error('[custom-domain] upsert error:', upsertError.message)
    return NextResponse.json({ error: 'Could not save domain. Please try again.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      domain,
      verified: false,
      txtRecord: { host: `${TXT_PREFIX}.${domain}`, value: `${TXT_VALUE_PREFIX}${token}` },
    },
    { status: 201 },
  )
}

// PATCH — attempt DNS TXT verification for the artist's pending domain.
export async function PATCH(): Promise<NextResponse> {
  const ctx = await requireStudioArtist()
  if (!ctx.ok) return ctx.response
  const { supabase, artist } = ctx

  const { data: row } = await supabase
    .from('custom_domains')
    .select('domain, verification_token, verified')
    .eq('artist_id', artist.id)
    .maybeSingle()

  if (!row || !row.verification_token) {
    return NextResponse.json({ error: 'Add a domain before verifying.' }, { status: 404 })
  }

  const expected = `${TXT_VALUE_PREFIX}${row.verification_token}`

  let records: string[][] = []
  try {
    records = await dns.resolveTxt(`${TXT_PREFIX}.${row.domain}`)
  } catch {
    return NextResponse.json(
      { verified: false, error: 'No verification TXT record found yet. DNS can take a few minutes to propagate.' },
      { status: 200 },
    )
  }

  const flattened = records.map((chunks) => chunks.join(''))
  const matched = flattened.some((value) => value.trim() === expected)

  if (!matched) {
    return NextResponse.json(
      { verified: false, error: 'The TXT record was found but its value does not match. Check for typos.' },
      { status: 200 },
    )
  }

  const service = createSupabaseServiceClient()
  const { error: updateError } = await service
    .from('custom_domains')
    .update({ verified: true, verified_at: new Date().toISOString() })
    .eq('artist_id', artist.id)

  if (updateError) {
    console.error('[custom-domain] verify update error:', updateError.message)
    return NextResponse.json({ error: 'Verification succeeded but saving failed. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ verified: true, domain: row.domain })
}

// DELETE — remove the domain mapping entirely.
export async function DELETE(): Promise<NextResponse> {
  const ctx = await requireStudioArtist()
  if (!ctx.ok) return ctx.response
  const { supabase, artist } = ctx

  const { error } = await supabase.from('custom_domains').delete().eq('artist_id', artist.id)

  if (error) {
    console.error('[custom-domain] delete error:', error.message)
    return NextResponse.json({ error: 'Could not remove domain. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
