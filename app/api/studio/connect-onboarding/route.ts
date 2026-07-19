import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { resolveStudioMembership, getUserPlan } from '@/lib/studio/access'
import Stripe from 'stripe'

/**
 * POST /api/studio/connect-onboarding
 *
 * Studio-owner counterpart to the artist connect-onboarding route. Creates (or
 * links) a Stripe Connect Express account for the STUDIO — keyed to
 * studios.stripe_connect_account_id — and returns an onboarding link. This is
 * the account that receives automated commission transfers from the platform.
 *
 * Distinct from the artist's own connected account (which still receives the
 * client's deposit/balance in full as a destination charge).
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Studio payouts are a Studio-plan feature, and only the studio OWNER may set
  // up the studio's payout account.
  const plan = await getUserPlan(user.id)
  if (plan !== 'studio') {
    return NextResponse.json({ error: 'Studio payouts require the Studio plan' }, { status: 403 })
  }

  const membership = await resolveStudioMembership(user.id)
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the studio owner can set up payouts' }, { status: 403 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe configuration is missing' }, { status: 500 })
  }

  const admin = createSupabaseAdminClient()

  // Load the studio row (service role) — current Connect account + owner email.
  const { data: studio, error: studioError } = await admin
    .from('studios')
    .select('id, stripe_connect_account_id')
    .eq('id', membership.studioId)
    .single()

  if (studioError || !studio) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 })
  }

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle()

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const appUrl = getAppUrl()

  let connectAccountId = studio.stripe_connect_account_id

  try {
    // 1. Create the studio's Connect Express account if not already present.
    if (!connectAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: ownerProfile?.email || user.email || undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      })
      connectAccountId = account.id

      const { error: updateError } = await admin
        .from('studios')
        .update({
          stripe_connect_account_id: connectAccountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', studio.id)

      if (updateError) {
        throw new Error(`Failed to persist studio Stripe Connect ID: ${updateError.message}`)
      }
    }

    // 2. Generate the account onboarding link (returns to the studio dashboard).
    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${appUrl}/dashboard/studio?stripe_connect=refresh`,
      return_url: `${appUrl}/dashboard/studio?stripe_connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('[studio/connect-onboarding] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe onboarding setup failed' },
      { status: 500 },
    )
  }
}
