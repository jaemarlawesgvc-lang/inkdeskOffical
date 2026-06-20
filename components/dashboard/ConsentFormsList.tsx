'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface Submission {
  id: string
  clientName: string
  clientDob: string
  tattooDescription: string
  signedAt: string
  viewedAt: string | null
  bookingId: string | null
  hasPdf: boolean
}

type SortOrder = 'newest' | 'oldest'

const inputCls =
  'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/50 transition-colors'

export function ConsentFormsList() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')

  useEffect(() => {
    fetch('/api/dashboard/consent-forms')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load consent forms')
        setSubmissions(json.submissions)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

  const handleDelete = async (id: string, clientName: string) => {
    if (!window.confirm(`Delete the consent form from ${clientName}? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/dashboard/consent-forms/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete')
      setSubmissions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev))
      toast.success('Consent form deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!submissions) return []
    const q = query.trim().toLowerCase()
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null

    return submissions
      .filter((s) => {
        if (q && !s.clientName.toLowerCase().includes(q) && !s.tattooDescription.toLowerCase().includes(q)) {
          return false
        }
        const ts = new Date(s.signedAt).getTime()
        if (fromTs !== null && ts < fromTs) return false
        if (toTs !== null && ts > toTs) return false
        return true
      })
      .sort((a, b) => {
        const diff = new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime()
        return sort === 'newest' ? -diff : diff
      })
  }, [submissions, query, fromDate, toDate, sort])

  const clearFilters = () => {
    setQuery('')
    setFromDate('')
    setToDate('')
    setSort('newest')
  }

  const hasActiveFilters = query || fromDate || toDate || sort !== 'newest'

  if (error) return <p className="text-red-400 text-sm">{error}</p>

  if (!submissions) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
        <p className="text-white/40 text-sm">No consent forms have been submitted yet.</p>
        <p className="text-white/25 text-xs mt-1.5">
          Forms filled out by clients via the link in booking emails or your public page footer will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Search + filters ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client name or tattoo description…"
            aria-label="Search consent forms"
            className={`${inputCls} pl-10`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <div className="space-y-1">
            <label htmlFor="cf-from" className="block text-xs text-white/40">From date</label>
            <input id="cf-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-to" className="block text-xs text-white/40">To date</label>
            <input id="cf-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cf-sort" className="block text-xs text-white/40">Sort</label>
            <select
              id="cf-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/50 transition-colors"
            >
              <option value="newest" className="bg-zinc-950">Newest first</option>
              <option value="oldest" className="bg-zinc-950">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            Showing {filtered.length} of {submissions.length}
          </p>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-white/50 hover:text-white transition-colors">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
          <p className="text-white/40 text-sm">No consent forms match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{s.clientName}</p>
                  {!s.viewedAt && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-[10px] font-semibold text-[#d4af37] uppercase tracking-wider">
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate">{s.tattooDescription}</p>
                <p className="text-[11px] text-white/30 mt-1">
                  Signed {new Date(s.signedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.hasPdf && (
                  <a
                    href={`/api/dashboard/consent-forms/${s.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    View PDF
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete(s.id, s.clientName)}
                  disabled={deletingId === s.id}
                  aria-label={`Delete consent form from ${s.clientName}`}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-40"
                >
                  {deletingId === s.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
