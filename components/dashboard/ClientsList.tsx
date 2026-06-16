'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ClientBooking {
  id: string
  booking_date: string
  booking_time: string | null
  status: string
}

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  booking_count: number
  last_booking_at: string | null
  notes: string | null
  bookings: ClientBooking[]
}

interface ClientsListProps {
  clients: Client[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function ClientsList({ clients }: ClientsListProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [noteValues, setNoteValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map((c) => [c.id, c.notes ?? ''])),
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'error'>>({})
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const saveNote = useCallback(
    async (clientId: string, note: string) => {
      setSavingId(clientId)
      try {
        const res = await fetch('/api/dashboard/client-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, note }),
        })
        setSaveStatus((prev) => ({
          ...prev,
          [clientId]: res.ok ? 'saved' : 'error',
        }))
        if (res.ok) router.refresh()
      } catch {
        setSaveStatus((prev) => ({ ...prev, [clientId]: 'error' }))
      } finally {
        setSavingId(null)
      }
    },
    [router],
  )

  const handleNoteChange = (clientId: string, value: string) => {
    setNoteValues((prev) => ({ ...prev, [clientId]: value }))
    setSaveStatus((prev) => ({ ...prev, [clientId]: undefined as unknown as 'saved' | 'error' }))

    if (debounceRefs.current[clientId]) {
      clearTimeout(debounceRefs.current[clientId])
    }
    debounceRefs.current[clientId] = setTimeout(() => {
      void saveNote(clientId, value)
    }, 800)
  }

  const filtered = clients.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search by name or email…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full max-w-sm bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
      />

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center">
          <p className="text-white/40 text-sm">No clients found.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
          {filtered.map((client) => {
            const isExpanded = expandedId === client.id
            return (
              <div key={client.id}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors duration-100 text-left"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 select-none">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{client.name}</p>
                      <p className="text-white/40 text-xs truncate">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-white/60 text-xs">
                        {client.booking_count} booking{client.booking_count !== 1 ? 's' : ''}
                      </p>
                      {client.last_booking_at && (
                        <p className="text-white/30 text-xs">
                          Last: {formatDate(client.last_booking_at)}
                        </p>
                      )}
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={[
                        'w-4 h-4 text-white/30 transition-transform duration-200',
                        isExpanded ? 'rotate-180' : '',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-5 pb-5 bg-white/[0.02] border-t border-white/10 space-y-4 pt-4">
                    {/* Contact */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Email</p>
                        <p className="text-white text-sm">{client.email}</p>
                      </div>
                      {client.phone && (
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Phone</p>
                          <p className="text-white text-sm">{client.phone}</p>
                        </div>
                      )}
                    </div>

                    {/* Booking history */}
                    {client.bookings.length > 0 && (
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Booking history</p>
                        <div className="space-y-1.5">
                          {client.bookings.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between py-1.5 text-sm"
                            >
                              <span className="text-white/60">
                                {formatDate(b.booking_date)}
                                {b.booking_time ? ` · ${b.booking_time}` : ''}
                              </span>
                              <span className="text-white/40 text-xs">
                                {STATUS_LABEL[b.status] ?? b.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes (debounced autosave) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-white/30 uppercase tracking-wider">Notes</p>
                        <span className="text-xs text-white/30">
                          {savingId === client.id
                            ? 'Saving…'
                            : saveStatus[client.id] === 'saved'
                              ? 'Saved'
                              : saveStatus[client.id] === 'error'
                                ? 'Save failed'
                                : 'Autosaves'}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Add private notes about this client…"
                        value={noteValues[client.id] ?? ''}
                        onChange={(e) => handleNoteChange(client.id, e.target.value)}
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
