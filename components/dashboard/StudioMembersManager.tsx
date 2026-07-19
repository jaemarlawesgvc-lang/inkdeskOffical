'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Member {
  id: string
  role: string
  status: string
  invitedEmail: string | null
  artistId: string | null
  displayName: string | null
  commissionRatePct: number | null
  boothRentPence: number | null
}

interface StudioMembersManagerProps {
  /** The current user's role in the studio, from the server. */
  role: 'owner' | 'artist' | 'front_desk'
}

const inputCls =
  'bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

function penceToPounds(pence: number | null): string {
  if (pence === null || pence === undefined) return ''
  return (pence / 100).toFixed(2)
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'front_desk') return 'Front desk'
  return 'Artist'
}

export function StudioMembersManager({ role }: StudioMembersManagerProps) {
  const isOwner = role === 'owner'
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'artist' | 'front_desk'>('artist')

  // Editing terms
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCommission, setEditCommission] = useState('')
  const [editBooth, setEditBooth] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/members')
      const json = (await res.json()) as { members?: Member[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not load members')
      setMembers(json.members ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/studio/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not send invite')
      setInviteEmail('')
      toast.success('Invite recorded')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (m: Member) => {
    setEditingId(m.id)
    setEditCommission(m.commissionRatePct === null ? '' : String(m.commissionRatePct))
    setEditBooth(penceToPounds(m.boothRentPence))
  }

  const saveTerms = async (memberId: string) => {
    setBusy(true)
    try {
      const commissionRatePct = editCommission.trim() === '' ? null : Number(editCommission)
      const boothPounds = editBooth.trim() === '' ? null : Number(editBooth)
      if (commissionRatePct !== null && (!Number.isFinite(commissionRatePct) || commissionRatePct < 0 || commissionRatePct > 100)) {
        toast.error('Commission must be between 0 and 100')
        setBusy(false)
        return
      }
      if (boothPounds !== null && (!Number.isFinite(boothPounds) || boothPounds < 0)) {
        toast.error('Booth rent must be 0 or more')
        setBusy(false)
        return
      }
      const res = await fetch('/api/studio/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          commissionRatePct,
          boothRentPence: boothPounds === null ? null : Math.round(boothPounds * 100),
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not save terms')
      setEditingId(null)
      toast.success('Terms updated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save terms')
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/studio/members?id=${memberId}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not remove member')
      toast.success('Member removed')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove member')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-white/30 text-sm">Loading members…</p>
  }

  return (
    <div className="space-y-5">
      {members.length > 0 ? (
        <ul className="space-y-3" aria-label="Studio members">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm">
                      {m.displayName ?? m.invitedEmail ?? 'Pending invite'}
                    </p>
                    <span className="text-[10px] uppercase tracking-wide text-white/40 border border-white/15 rounded px-1.5 py-0.5">
                      {roleLabel(m.role)}
                    </span>
                    {m.status === 'invited' && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-300/80 border border-amber-300/25 rounded px-1.5 py-0.5">
                        Invited
                      </span>
                    )}
                  </div>
                  {isOwner && m.role !== 'owner' && (
                    <p className="text-white/50 text-sm mt-1">
                      {m.commissionRatePct !== null ? `${m.commissionRatePct}% commission` : 'No commission'}
                      {' · '}
                      {m.boothRentPence !== null ? `£${penceToPounds(m.boothRentPence)} booth rent` : 'No booth rent'}
                    </p>
                  )}
                </div>

                {isOwner && m.role !== 'owner' && (
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="text-white/40 hover:text-white text-xs font-medium"
                    >
                      Terms
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeMember(m.id)}
                      disabled={busy}
                      className="text-red-400/70 hover:text-red-400 text-xs font-medium disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {editingId === m.id && isOwner && (
                <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      Commission (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={editCommission}
                        onChange={(e) => setEditCommission(e.target.value)}
                        className={`${inputCls} w-24`}
                        placeholder="e.g. 40"
                        aria-label="Commission percent"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      Booth rent (£)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editBooth}
                        onChange={(e) => setEditBooth(e.target.value)}
                        className={`${inputCls} w-28`}
                        placeholder="per period"
                        aria-label="Booth rent in pounds"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveTerms(m.id)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/30 text-sm">No members yet.</p>
      )}

      {isOwner && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <p className="text-sm font-medium text-white/70">Invite a member</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={`${inputCls} flex-1 min-w-[14rem]`}
              placeholder="artist@example.com"
              type="email"
              aria-label="Invite email"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'artist' | 'front_desk')}
              className={inputCls}
              aria-label="Invite role"
            >
              <option value="artist">Artist</option>
              <option value="front_desk">Front desk</option>
            </select>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={busy || !inviteEmail.includes('@')}
              className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
            >
              Invite
            </button>
          </div>
          <p className="text-white/30 text-xs">
            Invites are recorded against the email. Delivering the invite email and the
            accept-invite flow arrive with the full studio product.
          </p>
        </div>
      )}
    </div>
  )
}
