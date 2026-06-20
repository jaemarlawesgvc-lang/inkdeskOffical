import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createBillingPortalSession } from '@/lib/stripe/server'
import { getAppUrl } from '@/lib/app-url'

export async function POST(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account found. Subscribe to a plan first.' },
      { status: 404 },
    )
  }

  try {
    const portalUrl = await createBillingPortalSession({
      customerId: profile.stripe_customer_id,
      returnUrl: `${getAppUrl()}/dashboard/settings/billing`,
    })

    return NextResponse.json({ url: portalUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing portal creation failed'
    console.error('[billing-portal] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
