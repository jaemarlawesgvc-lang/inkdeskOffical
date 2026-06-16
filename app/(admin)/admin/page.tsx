import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsRow } from '@/components/dashboard/StatsRow'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'System Health' }

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ── Compute date boundaries ────────────────────────────────────────────────
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Parallel data fetches ──────────────────────────────────────────────────
  const [
    { count: totalProfiles },
    { count: activeRecentProfiles },
    { count: newSignups },
    { data: allDeposits },
    { count: failedWebhooks },
    { count: totalEmails },
    { count: failedEmails },
    { count: totalBookings },
    { count: totalArtists },
  ] = await Promise.all([
    // Total users
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),

    // Active users (updated in last 30 days — proxy for activity)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('updated_at', thirtyDaysAgo),

    // New signups (last 7 days)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    // Revenue (all deposit amounts from paid bookings)
    supabase
      .from('bookings')
      .select('deposit_amount')
      .eq('deposit_paid', true)
      .is('deleted_at', null),

    // Failed webhooks (not processed and has error)
    supabase
      .from('stripe_events')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false)
      .not('error', 'is', null),

    // Total emails sent
    supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true }),

    // Failed emails
    supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'sent'),

    // Total bookings
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),

    // Total artists
    supabase
      .from('artists')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
  ])

  // ── Calculate revenue ──────────────────────────────────────────────────────
  const revenue =
    allDeposits?.reduce((sum, b) => sum + (b.deposit_amount ?? 0), 0) ?? 0

  // ── Email failure rate ─────────────────────────────────────────────────────
  const emailTotal = totalEmails ?? 0
  const emailFails = failedEmails ?? 0
  const emailFailRate = emailTotal > 0 ? ((emailFails / emailTotal) * 100).toFixed(1) : '0.0'

  // ── Stats grid ─────────────────────────────────────────────────────────────
  const primaryStats = [
    {
      label: 'Active Users (30d)',
      value: String(activeRecentProfiles ?? 0),
      subtext: `${totalProfiles ?? 0} total registered`,
    },
    {
      label: 'New Signups (7d)',
      value: String(newSignups ?? 0),
    },
    {
      label: 'Revenue',
      value: `£${revenue.toFixed(0)}`,
      subtext: 'Deposits collected',
    },
    {
      label: 'Failed Webhooks',
      value: String(failedWebhooks ?? 0),
      subtext: failedWebhooks && failedWebhooks > 0 ? 'Requires attention' : 'All clear',
    },
  ]

  const secondaryStats = [
    {
      label: 'Email Failure Rate',
      value: `${emailFailRate}%`,
      subtext: `${emailFails} of ${emailTotal} failed`,
    },
    {
      label: 'Total Bookings',
      value: String(totalBookings ?? 0),
    },
    {
      label: 'Total Artists',
      value: String(totalArtists ?? 0),
    },
    {
      label: 'Total Users',
      value: String(totalProfiles ?? 0),
    },
  ]

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">System Health</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Platform overview and key metrics
        </p>
      </div>

      {/* Primary stats */}
      <StatsRow stats={primaryStats} />

      {/* Secondary stats */}
      <StatsRow stats={secondaryStats} />

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(failedWebhooks ?? 0) > 0 && (
          <a
            href="/admin/webhooks"
            className="flex items-center gap-3 p-4 rounded-xl border border-crimson-500/20 bg-crimson-500/5 hover:bg-crimson-500/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-crimson-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-crimson-400">
                {failedWebhooks} failed webhook{failedWebhooks !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-white/40">View and retry failed events</p>
            </div>
          </a>
        )}

        {emailFails > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-400">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-400">
                {emailFails} failed email{emailFails !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-white/40">{emailFailRate}% failure rate</p>
            </div>
          </div>
        )}

        {(failedWebhooks ?? 0) === 0 && emailFails === 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 col-span-full sm:col-span-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-400">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-400">All systems healthy</p>
              <p className="text-xs text-white/40">No failed webhooks or emails</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
