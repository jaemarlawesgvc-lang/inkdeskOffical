import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutSchema } from '@/lib/validations/stripe'
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckout,
  getStripe,
  STRIPE_PRICE_IDS,
} from '@/lib/stripe/server'
import { getAppUrl } from '@/lib/app-url'
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

  // Check if user already has an active PAID subscription.
  // Every user has a free subscription row (status='active', plan='free')
  // created at signup — that must NOT block starting a trial. Only an existing
  // paid (pro/studio) active/trialing subscription blocks a new checkout; those
  // change plans through the billing portal instead.
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, status, plan')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (existingSub && existingSub.plan !== 'free') {
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

    // Repeat-trial guard: Stripe is the source of truth. If this customer has
    // EVER had a subscription (any status, including canceled), don't grant a
    // fresh free trial — only genuinely-new customers get one. Prevents the
    // cancel-and-restart-forever free-trial loop.
    const priorSubs = await getStripe().subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    })
    const hasEverSubscribed = priorSubs.data.length > 0
    const trialPeriodDays = hasEverSubscribed ? 0 : SUBSCRIPTION_TRIAL_DAYS

    const appUrl = getAppUrl()
    const checkoutUrl = await createSubscriptionCheckout({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${appUrl}/dashboard/settings/billing?checkout=success`,
      cancelUrl: `${appUrl}/dashboard/settings/billing?checkout=cancelled`,
      trialPeriodDays,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe checkout creation failed'
    console.error('[create-checkout] Stripe error:', message)
    // Surface the real Stripe reason (e.g. "No such price", "Invalid API Key",
    // test/live mismatch) so misconfiguration is obvious instead of a generic
    // "Failed to create checkout session".
    return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500 })
  }
}
