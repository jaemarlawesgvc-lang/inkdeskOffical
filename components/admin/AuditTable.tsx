'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditRow {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

interface AuditTableProps {
  initialLogs: AuditRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuditTable({ initialLogs }: AuditTableProps) {
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')

  // Unique actions for filter dropdown
  const actions = Array.from(new Set(initialLogs.map((l) => l.action))).sort()

  const filtered = initialLogs.filter((l) => {
    if (filterAction !== 'all' && l.action !== filterAction) return false
    if (filterUser) {
      const q = filterUser.toLowerCase()
      const matchesEmail = l.userEmail?.toLowerCase().includes(q) ?? false
      const matchesId = l.userId?.toLowerCase().includes(q) ?? false
      if (!matchesEmail && !matchesId) return false
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom)
      if (new Date(l.createdAt) < from) return false
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59')
      if (new Date(l.createdAt) > to) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="all">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by user email…"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-gold-500 w-48"
        />

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-white/40">From</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-white/40">To</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-parchment-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <span className="text-sm text-white/40 tabular-nums">
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-white/40 uppercase text-xs tracking-widest">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Resource</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/30">
                  No audit log entries match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-white/[0.02] transition-colors align-top">
                <td className="px-4 py-3 text-white/40 text-xs tabular-nums whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-white/60 font-mono text-xs">
                  {log.userEmail ?? log.userId ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/60">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  {log.resourceType && log.resourceId
                    ? `${log.resourceType}:${log.resourceId.slice(0, 8)}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-white/30 font-mono text-xs">
                  {log.ipAddress ?? '—'}
                </td>
                <td className="px-4 py-3 text-white/30 text-xs max-w-[200px]">
                  {log.metadata ? (
                    <span className="truncate block" title={JSON.stringify(log.metadata)}>
                      {JSON.stringify(log.metadata).slice(0, 60)}{JSON.stringify(log.metadata).length > 60 ? '…' : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
