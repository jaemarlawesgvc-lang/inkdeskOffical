'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionRow {
  id: string
  userEmail: string
  plan: string
  status: string
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  createdAt: string
}

interface SubscriptionsTableProps {
  initialSubscriptions: SubscriptionRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-500/20 text-emerald-400',
  trialing:  'bg-sky-500/20 text-sky-400',
  past_due:  'bg-amber-500/20 text-amber-400',
  cancelled: 'bg-white/10 text-white/40',
}

function stripeLink(type: 'customer' | 'subscription', id: string): string {
  return `https://dashboard.stripe.com/${type === 'customer' ? 'customers' : 'subscriptions'}/${id}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubscriptionsTable({ initialSubscriptions }: SubscriptionsTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filtered = initialSubscriptions.filter((s) => {
    if (filterStatus === 'all') return true
    return s.status === filterStatus
  })

  const pastDueCount = initialSubscriptions.filter((s) => s.status === 'past_due').length

  return (
    <div className="space-y-4">
      {/* Past due alert */}
      {pastDueCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {pastDueCount} subscription{pastDueCount !== 1 ? 's' : ''} past due
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <span className="text-sm text-white/40 tabular-nums">
          {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-white/40 uppercase text-xs tracking-widest">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Period End</th>
              <th className="px-4 py-3 font-medium">Cancelling</th>
              <th className="px-4 py-3 font-medium">Stripe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                  No subscriptions match the current filter.
                </td>
              </tr>
            )}
            {filtered.map((sub) => (
              <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-white font-mono text-xs">{sub.userEmail}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      sub.plan === 'studio'
                        ? 'bg-violet-500/20 text-violet-400'
                        : sub.plan === 'pro'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {sub.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[sub.status] ?? 'bg-white/10 text-white/40'}`}
                  >
                    {sub.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs tabular-nums">
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  {sub.cancelAtPeriodEnd ? (
                    <span className="text-amber-400">Yes</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {sub.stripeSubscriptionId && (
                      <a
                        href={stripeLink('subscription', sub.stripeSubscriptionId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Subscription
                      </a>
                    )}
                    {sub.stripeCustomerId && (
                      <a
                        href={stripeLink('customer', sub.stripeCustomerId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Customer
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
