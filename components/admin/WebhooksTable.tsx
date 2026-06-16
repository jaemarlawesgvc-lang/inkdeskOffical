'use client'

import { useState, useTransition } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookEventRow {
  id: string
  stripeEventId: string
  eventType: string
  processed: boolean
  processedAt: string | null
  error: string | null
  createdAt: string
  payload: Record<string, unknown>
}

interface WebhooksTableProps {
  initialEvents: WebhookEventRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WebhooksTable({ initialEvents }: WebhooksTableProps) {
  const [events, setEvents] = useState(initialEvents)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Unique event types for filter dropdown
  const eventTypes = Array.from(new Set(events.map((e) => e.eventType))).sort()

  const filtered = events.filter((e) => {
    if (filterType !== 'all' && e.eventType !== filterType) return false
    if (filterStatus === 'processed' && !e.processed) return false
    if (filterStatus === 'failed' && (e.processed || !e.error)) return false
    if (filterStatus === 'pending' && (e.processed || e.error)) return false
    return true
  })

  async function handleRetry(eventId: string) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/webhooks/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionMessage({ type: 'error', text: data.error ?? 'Retry failed' })
          return
        }
        // Update local state
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, processed: true, processedAt: new Date().toISOString(), error: null }
              : e,
          ),
        )
        setActionMessage({ type: 'success', text: 'Event reprocessed successfully' })
      } catch {
        setActionMessage({ type: 'error', text: 'Network error' })
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Event Types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Statuses</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        <span className="text-sm text-white/40 tabular-nums">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action feedback */}
      {actionMessage && (
        <div
          className={`text-sm px-4 py-2 rounded-lg ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-crimson-500/10 text-crimson-400'
          }`}
          role="alert"
        >
          {actionMessage.text}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-white/40 uppercase text-xs tracking-widest">
            <tr>
              <th className="px-4 py-3 font-medium">Event ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                  No events match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((event) => {
              const isExpanded = expandedId === event.id
              return (
                <tr key={event.id} className="hover:bg-white/[0.02] transition-colors align-top">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="text-white font-mono text-xs hover:text-gold-400 transition-colors text-left"
                      title="Toggle payload viewer"
                    >
                      {event.stripeEventId.slice(0, 24)}…
                    </button>
                    {isExpanded && (
                      <div className="mt-3 max-h-64 overflow-auto rounded-lg bg-ink-950 border border-white/5 p-3">
                        <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs font-mono">{event.eventType}</td>
                  <td className="px-4 py-3">
                    {event.processed ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                        Processed
                      </span>
                    ) : event.error ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-crimson-500/20 text-crimson-400">
                        Failed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-crimson-400 text-xs max-w-[200px] truncate" title={event.error ?? undefined}>
                    {event.error ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs tabular-nums whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {!event.processed && event.error && (
                      <button
                        onClick={() => handleRetry(event.id)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30 bg-gold-500/10 text-gold-400 hover:bg-gold-500/20"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
