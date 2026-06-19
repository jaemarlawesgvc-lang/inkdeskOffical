import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutSchema } from '@/lib/validations/stripe'
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckout,
  STRIPE_PRICE_IDS,
} from '@/lib/stripe/server'
import { clientEnv } from '@/lib/env.client'
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/constants'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { plan } = parsed.data
  const priceId = STRIPE_PRICE_IDS[plan]

  // Check if user already has an active subscription
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, status, plan')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (existingSub) {
    return NextResponse.json(
      {
        error: `You already have an active ${existingSub.plan} subscription. Use the billing portal to change plans.`,
        upgradeUrl: '/dashboard/settings/billing',
      },
      { status: 409 },
    )
  }

  // Get or create profile for stripeCustomerId
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  try {
    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: profile.email,
      name: profile.full_name ?? undefined,
      existingCustomerId: profile.stripe_customer_id,
    })

    // Persist customerId on profile if it was newly created
    if (customerId !== profile.stripe_customer_id) {
      await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    const appUrl = clientEnv.appUrl
    const checkoutUrl = await createSubscriptionCheckout({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${appUrl}/dashboard/settings/billing?checkout=success`,
      cancelUrl: `${appUrl}/dashboard/settings/billing?checkout=cancelled`,
      trialPeriodDays: SUBSCRIPTION_TRIAL_DAYS,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe checkout creation failed'
    console.error('[create-checkout] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
