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

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  deposit_paid: 'bg-blue-400',
  completed: 'bg-white/30',
  cancelled: 'bg-red-400',
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
        setSaveStatus((prev) => ({ ...prev, [clientId]: res.ok ? 'saved' : 'error' }))
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
    if (debounceRefs.current[clientId]) clearTimeout(debounceRefs.current[clientId])
    debounceRefs.current[clientId] = setTimeout(() => void saveNote(clientId, value), 800)
  }

  const filtered = clients.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white/30" aria-hidden="true">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          </div>
          <p className="text-white/60 text-sm font-medium">No clients found</p>
          <p className="text-white/30 text-xs">Clients appear here after their first booking.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/[0.06]">
          {filtered.map((client) => {
            const isExpanded = expandedId === client.id
            const initials = client.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
            return (
              <div key={client.id}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-white/[0.03] transition-colors duration-100 text-left"
                  aria-expanded={isExpanded}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-gold-500/20 to-white/5 border border-white/10 flex items-center justify-center text-white/70 text-xs font-bold select-none">
                    {initials}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{client.name}</p>
                      {client.notes && (
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gold-500/60" title="Has notes" />
                      )}
                    </div>
                    <p className="text-white/35 text-xs truncate">{client.email}</p>
                  </div>

                  {/* Booking count + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-white/50 text-xs font-medium">{client.booking_count} booking{client.booking_count !== 1 ? 's' : ''}</p>
                      {client.last_booking_at && (
                        <p className="text-white/25 text-[11px]">Last {formatDate(client.last_booking_at)}</p>
                      )}
                    </div>
                    <div className="sm:hidden text-white/40 text-xs font-medium">{client.booking_count}</div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      className={['w-4 h-4 text-white/20 transition-transform duration-200', isExpanded ? 'rotate-180' : ''].join(' ')}
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="bg-white/[0.015] border-t border-white/[0.06] px-4 sm:px-5 py-5 space-y-5">
                    {/* Contact details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Email</p>
                        <a href={`mailto:${client.email}`} className="text-sm text-white/70 hover:text-white transition-colors break-all">{client.email}</a>
                      </div>
                      {client.phone && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Phone</p>
                          <a href={`tel:${client.phone}`} className="text-sm text-white/70 hover:text-white transition-colors">{client.phone}</a>
                        </div>
                      )}
                    </div>

                    {/* Booking history */}
                    {client.bookings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">Booking history</p>
                        <div className="space-y-1">
                          {client.bookings.map((b) => (
                            <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                              <div className="flex items-center gap-2">
                                <span className={['w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT[b.status] ?? 'bg-white/20'].join(' ')} aria-hidden="true" />
                                <span className="text-sm text-white/60">{formatDate(b.booking_date)}{b.booking_time ? ` · ${b.booking_time.slice(0,5)}` : ''}</span>
                              </div>
                              <span className="text-xs text-white/30">{STATUS_LABEL[b.status] ?? b.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Private notes</p>
                        <span className={[
                          'text-[11px] transition-colors',
                          savingId === client.id ? 'text-white/30' :
                          saveStatus[client.id] === 'saved' ? 'text-emerald-400' :
                          saveStatus[client.id] === 'error' ? 'text-red-400' :
                          'text-white/20',
                        ].join(' ')}>
                          {savingId === client.id ? 'Saving…' :
                           saveStatus[client.id] === 'saved' ? 'Saved ✓' :
                           saveStatus[client.id] === 'error' ? 'Save failed' :
                           'Autosaves'}
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        placeholder="Add private notes — allergies, style preferences, past work, reference ideas…"
                        value={noteValues[client.id] ?? ''}
                        onChange={(e) => handleNoteChange(client.id, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white/80 placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
                      />
                      <p className="text-[11px] text-white/20 mt-1.5">Only visible to you. Never shared with clients.</p>
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
