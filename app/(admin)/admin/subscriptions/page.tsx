import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SubscriptionsTable } from '@/components/admin/SubscriptionsTable'
import { PlanChart } from '@/components/admin/PlanChart'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Subscriptions' }

export default async function AdminSubscriptionsPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all subscriptions with user email
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id,
      plan,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      current_period_end,
      cancel_at_period_end,
      created_at,
      profiles!subscriptions_user_id_fkey (
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const mappedSubscriptions = (subscriptions ?? []).map((s) => {
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
    return {
      id: s.id,
      userEmail: profile?.email ?? 'Unknown',
      plan: s.plan,
      status: s.status,
      stripeSubscriptionId: s.stripe_subscription_id,
      stripeCustomerId: s.stripe_customer_id,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
      createdAt: s.created_at,
    }
  })

  // Calculate plan distribution
  const planCounts: Record<string, number> = { free: 0, pro: 0, studio: 0 }
  for (const sub of mappedSubscriptions) {
    if (sub.status === 'active' || sub.status === 'trialing') {
      planCounts[sub.plan] = (planCounts[sub.plan] ?? 0) + 1
    } else {
      planCounts.free = (planCounts.free ?? 0) + 1
    }
  }

  const distribution = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }))

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
        <p className="text-white/40 text-sm mt-0.5">
          All subscriptions and plan distribution
        </p>
      </div>

      {/* Plan distribution chart */}
      <PlanChart distribution={distribution} />

      {/* Subscriptions table */}
      <SubscriptionsTable initialSubscriptions={mappedSubscriptions} />
    </div>
  )
}
