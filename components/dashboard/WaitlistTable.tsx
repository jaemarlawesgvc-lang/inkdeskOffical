'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface WaitlistEntry {
  id: string
  clientName: string
  clientEmail: string
  preferredStyles: string[]
  flexibleOnDate: boolean
  preferredDateFrom: string | null
  preferredDateTo: string | null
  notifiedAt: string | null
  createdAt: string
}

interface WaitlistTableProps {
  entries: WaitlistEntry[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function WaitlistTable({ entries }: WaitlistTableProps) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'notified' | 'pending'>('all')
  const [search, setSearch] = useState('')

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    setError(null)
    const { error: deleteError } = await supabase.from('waitlist').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else router.refresh()
    setRemovingId(null)
  }

  const handleNotify = async (id: string) => {
    setNotifyingId(id)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/waitlist/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistId: id }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to notify')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setNotifyingId(null)
    }
  }

  const filtered = entries.filter((e) => {
    if (filter === 'notified' && !e.notifiedAt) return false
    if (filter === 'pending' && e.notifiedAt) return false
    if (search && !e.clientName.toLowerCase().includes(search.toLowerCase()) && !e.clientEmail.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const notifiedCount = entries.filter((e) => e.notifiedAt).length
  const pendingCount = entries.length - notifiedCount

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white/30" aria-hidden="true">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a.78.78 0 01-.07.345zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
          </svg>
        </div>
        <p className="text-white/60 text-sm font-medium">No one on your waitlist yet</p>
        <p className="text-white/30 text-xs">When clients join your waitlist, they&apos;ll appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Stats + filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'notified'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                filter === f
                  ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:text-white/80',
              ].join(' ')}
            >
              {f === 'all' ? `All (${entries.length})` : f === 'pending' ? `Pending (${pendingCount})` : `Notified (${notifiedCount})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto w-full sm:w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white/80 placeholder-white/25 text-xs focus:outline-none focus:border-white/40 transition-colors"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-white/40 text-sm">No entries match this filter.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/[0.06]">
          {filtered.map((entry) => (
            <div key={entry.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 text-sm font-semibold select-none">
                  {entry.clientName.charAt(0).toUpperCase()}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold">{entry.clientName}</p>
                    {entry.notifiedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5" aria-hidden="true">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L4.586 8l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Notified
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                        Waiting
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5">{entry.clientEmail}</p>

                  {/* Date preferences + styles */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                        <path fillRule="evenodd" d="M4 1.75a.75.75 0 01.75.75V3h6.5V2.5a.75.75 0 011.5 0V3H14A1.5 1.5 0 0115.5 4.5v9A1.5 1.5 0 0114 15H2A1.5 1.5 0 01.5 13.5v-9A1.5 1.5 0 012 3h1.25V2.5A.75.75 0 014 1.75zM2 6.5h12v7H2v-7z" clipRule="evenodd" />
                      </svg>
                      {entry.flexibleOnDate
                        ? 'Flexible on dates'
                        : [entry.preferredDateFrom && formatDate(entry.preferredDateFrom), entry.preferredDateTo && formatDate(entry.preferredDateTo)].filter(Boolean).join(' – ') || 'No date preference'}
                    </span>
                    {entry.preferredStyles.length > 0 && entry.preferredStyles.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-white/5 text-white/40 text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>

                  {entry.notifiedAt && (
                    <p className="text-[11px] text-white/25 mt-1">Notified {formatDate(entry.notifiedAt)}</p>
                  )}
                </div>

                {/* Right: time + actions */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-[11px] text-white/25">{timeAgo(entry.createdAt)}</span>
                  <div className="flex items-center gap-1.5">
                    {!entry.notifiedAt && (
                      <button
                        type="button"
                        onClick={() => void handleNotify(entry.id)}
                        disabled={notifyingId === entry.id}
                        className="px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 text-[11px] font-semibold hover:bg-gold-500/20 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        {notifyingId === entry.id ? 'Sending…' : 'Notify'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRemove(entry.id)}
                      disabled={removingId === entry.id}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 disabled:opacity-40 transition-colors"
                      aria-label="Remove from waitlist"
                    >
                      {removingId === entry.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5zM6.05 6a.75.75 0 01.787.713l.275 5.5a.75.75 0 01-1.498.075l-.275-5.5A.75.75 0 016.05 6zm3.9 0a.75.75 0 01.712.787l-.275 5.5a.75.75 0 01-1.498-.075l.275-5.5a.75.75 0 01.786-.712z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
