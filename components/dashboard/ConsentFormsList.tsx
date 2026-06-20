'use client'

import { useEffect, useState } from 'react'

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

export function ConsentFormsList() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/consent-forms')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load consent forms')
        setSubmissions(json.submissions)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

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
    <div className="space-y-3">
      {submissions.map((s) => (
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
          {s.hasPdf && (
            <a
              href={`/api/dashboard/consent-forms/${s.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              View PDF
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
