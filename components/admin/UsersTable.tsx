'use client'

import { useState, useTransition } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  email: string
  fullName: string | null
  role: string
  plan: string
  subscriptionStatus: string | null
  createdAt: string
  deletedAt: string | null
}

interface UsersTableProps {
  initialUsers: UserRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UsersTable({ initialUsers }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.fullName?.toLowerCase().includes(q) ?? false)
    )
  })

  // ── Actions ──

  async function handleSuspend(userId: string, suspend: boolean) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users/suspend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, suspend }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionMessage({ type: 'error', text: data.error ?? 'Failed to update user' })
          return
        }
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, deletedAt: suspend ? new Date().toISOString() : null }
              : u,
          ),
        )
        setActionMessage({
          type: 'success',
          text: suspend ? 'User suspended' : 'User unsuspended',
        })
      } catch {
        setActionMessage({ type: 'error', text: 'Network error' })
      }
    })
  }

  async function handleResetPassword(userId: string) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionMessage({ type: 'error', text: data.error ?? 'Failed to send reset email' })
          return
        }
        setActionMessage({ type: 'success', text: 'Password reset email sent' })
      } catch {
        setActionMessage({ type: 'error', text: 'Network error' })
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
        />
        <span className="text-sm text-white/40 tabular-nums">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
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
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Signed Up</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/30">
                  {search ? 'No users match your search.' : 'No users found.'}
                </td>
              </tr>
            )}
            {filtered.map((user) => {
              const isSuspended = !!user.deletedAt
              return (
                <tr
                  key={user.id}
                  className={`transition-colors ${isSuspended ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-4 py-3 text-white font-mono text-xs">{user.email}</td>
                  <td className="px-4 py-3 text-white/60">{user.fullName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        user.role === 'admin'
                          ? 'bg-crimson-500/20 text-crimson-400'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        user.plan === 'studio'
                          ? 'bg-violet-500/20 text-violet-400'
                          : user.plan === 'pro'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isSuspended ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-crimson-500/20 text-crimson-400">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs tabular-nums">
                    {new Date(user.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSuspend(user.id, !isSuspended)}
                        disabled={isPending || user.role === 'admin'}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        title={user.role === 'admin' ? 'Cannot suspend admin users' : undefined}
                      >
                        {isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-30 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        Reset Password
                      </button>
                    </div>
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
