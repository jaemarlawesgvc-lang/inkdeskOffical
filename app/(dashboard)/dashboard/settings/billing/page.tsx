import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveActivePlan } from '@/lib/stripe/plans'
import { BillingPanel } from '@/components/dashboard/BillingPanel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Billing' }

interface BillingPageProps {
  searchParams: { checkout?: string }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription ?? null)

  const checkout =
    searchParams?.checkout === 'success'
      ? 'success'
      : searchParams?.checkout === 'cancelled'
        ? 'cancelled'
        : null

  return (
    <BillingPanel
      plan={plan}
      status={subscription?.status ?? null}
      currentPeriodEnd={subscription?.current_period_end ?? null}
      cancelAtPeriodEnd={Boolean(subscription?.cancel_at_period_end)}
      checkout={checkout}
    />
  )
}
