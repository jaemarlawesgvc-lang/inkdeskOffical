import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import Stripe from 'stripe'

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, stripe_connect_account_id, profiles(email)')
    .eq('user_id', user.id)
    .single()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe configuration is missing' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const appUrl = getAppUrl()

  let connectAccountId = artist.stripe_connect_account_id

  try {
    // 1. Create a Connected Express Account if not already present
    if (!connectAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: (artist.profiles as unknown as { email: string })?.email || undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      })
      connectAccountId = account.id

      const adminDb = createSupabaseAdminClient()
      const { error: updateError } = await adminDb
        .from('artists')
        .update({
          stripe_connect_account_id: connectAccountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', artist.id)

      if (updateError) {
        throw new Error(`Failed to update artist Stripe Connect ID: ${updateError.message}`)
      }
    }

    // 2. Generate Account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${appUrl}/dashboard/settings?stripe_connect=refresh`,
      return_url: `${appUrl}/dashboard/settings?stripe_connect=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('[stripe/connect-onboarding] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe onboarding setup failed' }, { status: 500 })
  }
}
