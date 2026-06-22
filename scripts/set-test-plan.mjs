// Dev/test helper: puts a Supabase user on the Pro/Studio plan via a real Stripe
// test-mode subscription (using Stripe's pm_card_visa test payment method, which
// always succeeds), so you can test plan-gated features without clicking through
// Checkout each time. Also handles downgrading back to free (cancels the Stripe
// subscription) and switching between Pro <-> Studio in place.
//
// Usage:
//   node scripts/set-test-plan.mjs <email> <free|pro|studio>
//
// Requires .env.local to contain STRIPE_SECRET_KEY (must be sk_test_...),
// NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_PRICE_PRO_MONTHLY,
// STRIPE_PRICE_STUDIO_MONTHLY. The target email must already have an account
// (sign up in the app first) — this only flips their plan, it doesn't create users.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
  const envPath = path.join(root, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const [, , emailArg, planArg] = process.argv
const plan = (planArg ?? '').toLowerCase()

if (!emailArg || !['free', 'pro', 'studio'].includes(plan)) {
  console.error('Usage: node scripts/set-test-plan.mjs <email> <free|pro|studio>')
  process.exit(1)
}

for (const key of [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_STUDIO_MONTHLY',
]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} — set it in .env.local`)
    process.exit(1)
  }
}

if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('STRIPE_SECRET_KEY is not a test key (sk_test_...). Refusing to run against live mode.')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20', typescript: false })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
  studio: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
}

async function getProfile() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('email', emailArg)
    .is('deleted_at', null)
    .single()

  if (error || !profile) {
    console.error(`No account found for ${emailArg}. Sign up that account in the app first.`)
    process.exit(1)
  }
  return profile
}

async function getOrCreateCustomer(profile) {
  if (profile.stripe_customer_id) {
    const existing = await stripe.customers.retrieve(profile.stripe_customer_id).catch(() => null)
    if (existing && !existing.deleted) return profile.stripe_customer_id
  }
  const customer = await stripe.customers.create({
    email: profile.email,
    metadata: { supabase_user_id: profile.id },
  })
  await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', profile.id)
  console.log(`Created Stripe customer ${customer.id}`)
  return customer.id
}

async function syncSupabase(profile, customerId, resolvedPlan, subscription) {
  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: profile.id,
      stripe_subscription_id: subscription?.id ?? null,
      stripe_customer_id: customerId,
      plan: resolvedPlan,
      status: subscription
        ? subscription.status === 'trialing'
          ? 'trialing'
          : 'active'
        : 'cancelled',
      current_period_start: subscription ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      current_period_end: subscription ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`Supabase sync failed: ${error.message}`)
}

async function main() {
  const profile = await getProfile()

  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', profile.id)
    .maybeSingle()

  // ── Downgrade to free: cancel the live Stripe subscription, if any ──
  if (plan === 'free') {
    if (existingSub?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(existingSub.stripe_subscription_id).catch((err) => {
        // Already cancelled / doesn't exist — fine, we're resetting to free either way.
        console.warn(`Stripe cancel skipped: ${err instanceof Error ? err.message : err}`)
      })
    }
    await syncSupabase(profile, profile.stripe_customer_id, 'free', null)
    console.log(`\n${profile.email} is now on the free plan.`)
    return
  }

  // ── Pro / Studio: update the existing live subscription in place, or create one ──
  const customerId = await getOrCreateCustomer(profile)
  const priceId = PRICE_IDS[plan]

  let subscription = null
  if (existingSub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(existingSub.status)) {
    const current = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id).catch(() => null)
    if (current && current.status !== 'canceled') {
      subscription = await stripe.subscriptions.update(current.id, {
        items: [{ id: current.items.data[0].id, price: priceId }],
        proration_behavior: 'none',
      })
      console.log(`Updated existing subscription ${subscription.id} → ${plan}`)
    }
  }

  if (!subscription) {
    const paymentMethod = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId })
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethod.id },
    })
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: { supabase_user_id: profile.id },
    })
    console.log(`Created subscription ${subscription.id} (${plan})`)
  }

  if (subscription.status === 'incomplete') {
    console.warn('Subscription is "incomplete" — the test payment may not have gone through as expected.')
  }

  await syncSupabase(profile, customerId, plan, subscription)
  console.log(`\n${profile.email} is now on the ${plan} plan (status: ${subscription.status}).`)
  console.log('Refresh /dashboard/settings/billing to see it reflected.')
}

main().catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
