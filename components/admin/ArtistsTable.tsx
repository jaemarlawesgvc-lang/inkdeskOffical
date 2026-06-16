'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistRow {
  id: string
  userId: string
  username: string | null
  displayName: string | null
  email: string
  plan: string
  onboardingComplete: boolean
  onboardingStep: number
  createdAt: string
}

interface ArtistsTableProps {
  initialArtists: ArtistRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArtistsTable({ initialArtists }: ArtistsTableProps) {
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [filterOnboarding, setFilterOnboarding] = useState<string>('all')

  const filtered = initialArtists.filter((a) => {
    if (filterPlan !== 'all' && a.plan !== filterPlan) return false
    if (filterOnboarding === 'complete' && !a.onboardingComplete) return false
    if (filterOnboarding === 'incomplete' && a.onboardingComplete) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="studio">Studio</option>
        </select>

        <select
          value={filterOnboarding}
          onChange={(e) => setFilterOnboarding(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Onboarding</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>

        <span className="text-sm text-white/40 tabular-nums">
          {filtered.length} artist{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-white/40 uppercase text-xs tracking-widest">
            <tr>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Onboarding</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/30">
                  No artists match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((artist) => (
              <tr key={artist.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-white font-mono text-xs">
                  {artist.username ?? '—'}
                </td>
                <td className="px-4 py-3 text-white/80">
                  {artist.displayName ?? '—'}
                </td>
                <td className="px-4 py-3 text-white/60 font-mono text-xs">
                  {artist.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      artist.plan === 'studio'
                        ? 'bg-violet-500/20 text-violet-400'
                        : artist.plan === 'pro'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {artist.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {artist.onboardingComplete ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                      Complete
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                      Step {artist.onboardingStep}/5
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/40 text-xs tabular-nums">
                  {new Date(artist.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {artist.username && artist.onboardingComplete && (
                      <a
                        href={`/${artist.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Public Page
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
