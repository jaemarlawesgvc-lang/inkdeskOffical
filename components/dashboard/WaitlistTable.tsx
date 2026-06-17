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

export function WaitlistTable({ entries }: WaitlistTableProps) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = async (id: string) => {
    setRemovingId(id)
    setError(null)
    const { error: deleteError } = await supabase.from('waitlist').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else router.refresh()
    setRemovingId(null)
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center">
        <p className="text-white/40 text-sm">No one is on your waitlist yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">{entry.clientName}</p>
              <p className="text-white/40 text-xs mt-0.5">{entry.clientEmail}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {entry.flexibleOnDate
                  ? 'Flexible on dates'
                  : [entry.preferredDateFrom, entry.preferredDateTo].filter(Boolean).join(' – ') || 'No date preference given'}
                {entry.notifiedAt && <span className="ml-2 text-emerald-400">Notified</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleRemove(entry.id)}
              disabled={removingId === entry.id}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs font-semibold hover:bg-white/20 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              {removingId === entry.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
