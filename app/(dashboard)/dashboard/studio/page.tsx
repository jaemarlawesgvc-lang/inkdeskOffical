import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveActivePlan } from '@/lib/stripe/plans'
import { resolveStudioMembership } from '@/lib/studio/access'
import { LockedFeature } from '@/components/dashboard/LockedFeature'
import { StudioCreateForm } from '@/components/dashboard/StudioCreateForm'
import { StudioMembersManager } from '@/components/dashboard/StudioMembersManager'
import { StudioCalendar } from '@/components/dashboard/StudioCalendar'
import { StudioEarnings } from '@/components/dashboard/StudioEarnings'
import { StudioConnectCard } from '@/components/dashboard/StudioConnectCard'

export const metadata: Metadata = { title: 'Studio' }

export default async function StudioPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription ?? null)

  // ── Plan gate — Studio is a Studio-plan feature ───────────────────────────
  if (plan !== 'studio') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Studio</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Run a multi-artist studio: shared calendar, member management, and commission tracking.
          </p>
        </div>
        <LockedFeature
          title="Studio is a Studio-plan feature"
          description="Upgrade to invite artists, see a shared calendar, and track commission and booth rent across your studio."
          reason="The multi-artist studio tools are part of the Studio plan."
          cta="Upgrade to Studio"
        />
      </div>
    )
  }

  const membership = await resolveStudioMembership(user.id)

  // Owner-only: the studio's own Connect payout account (receives commission).
  let studioConnect: { status: string; hasAccount: boolean } | null = null
  if (membership?.role === 'owner') {
    const { data: studioRow } = await supabase
      .from('studios')
      .select('stripe_connect_account_id, stripe_connect_status')
      .eq('id', membership.studioId)
      .maybeSingle()
    studioConnect = {
      status: studioRow?.stripe_connect_status ?? 'none',
      hasAccount: Boolean(studioRow?.stripe_connect_account_id),
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Studio</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {membership
            ? membership.studio.name
            : 'Run a multi-artist studio: shared calendar, member management, and commission tracking.'}
        </p>
      </div>

      {!membership ? (
        <StudioCreateForm />
      ) : (
        <div className="space-y-6">
          <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Members</h2>
            <StudioMembersManager role={membership.role} />
          </section>

          <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Shared calendar</h2>
            <StudioCalendar />
          </section>

          {membership.role === 'owner' && studioConnect && (
            <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
              <h2 className="text-white font-semibold mb-4">Payouts</h2>
              <StudioConnectCard
                status={studioConnect.status}
                hasAccount={studioConnect.hasAccount}
              />
            </section>
          )}

          {membership.role === 'owner' && (
            <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
              <h2 className="text-white font-semibold mb-1">Earnings & owed ledger</h2>
              <StudioEarnings />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
