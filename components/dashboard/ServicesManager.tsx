'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Service {
  id: string
  name: string
  durationMinutes: number
  pricePence: number | null
  active: boolean
  sortOrder: number
}

interface ServicesManagerProps {
  initialServices: Service[]
}

const inputCls =
  'bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

function formatPrice(pence: number | null): string {
  if (pence === null || pence === undefined) return '—'
  return `£${(pence / 100).toFixed(2)}`
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function ServicesManager({ initialServices }: ServicesManagerProps) {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>(initialServices)
  const [busy, setBusy] = useState(false)

  // New-service form state
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDuration, setEditDuration] = useState('60')
  const [editPrice, setEditPrice] = useState('')

  const poundsToPence = (v: string): number | null => {
    const trimmed = v.trim()
    if (!trimmed) return null
    const num = Number(trimmed)
    if (!Number.isFinite(num) || num < 0) return null
    return Math.round(num * 100)
  }

  const handleAdd = async () => {
    const durationMinutes = Number(duration)
    if (!name.trim() || !Number.isFinite(durationMinutes) || durationMinutes < 1) {
      toast.error('Name and a valid duration are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          durationMinutes,
          pricePence: poundsToPence(price),
        }),
      })
      const json = (await res.json()) as { service?: Service; error?: string }
      if (!res.ok || !json.service) throw new Error(json.error ?? 'Could not add service')
      setServices((prev) => [...prev, json.service as Service])
      setName('')
      setDuration('60')
      setPrice('')
      toast.success('Service added')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add service')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (s: Service) => {
    setEditingId(s.id)
    setEditName(s.name)
    setEditDuration(String(s.durationMinutes))
    setEditPrice(s.pricePence === null ? '' : (s.pricePence / 100).toString())
  }

  const cancelEdit = () => setEditingId(null)

  const handleSaveEdit = async () => {
    if (!editingId) return
    const durationMinutes = Number(editDuration)
    if (!editName.trim() || !Number.isFinite(durationMinutes) || durationMinutes < 1) {
      toast.error('Name and a valid duration are required')
      return
    }
    setBusy(true)
    try {
      const pricePence = poundsToPence(editPrice)
      const res = await fetch('/api/dashboard/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), durationMinutes, pricePence }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not save changes')
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, name: editName.trim(), durationMinutes, pricePence }
            : s,
        ),
      )
      cancelEdit()
      toast.success('Service updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (s: Service) => {
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, active: !s.active }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not update service')
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update service')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/dashboard/services?id=${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not delete service')
      setServices((prev) => prev.filter((s) => s.id !== id))
      toast.success('Service removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete service')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {services.length > 0 && (
        <ul className="space-y-3" aria-label="Services">
          {services.map((s) => (
            <li key={s.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              {editingId === s.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`${inputCls} w-full`}
                    maxLength={100}
                    placeholder="Service name"
                    aria-label="Edit service name"
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      Duration (min)
                      <input
                        type="number"
                        min={1}
                        max={960}
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className={`${inputCls} w-24`}
                        aria-label="Edit duration in minutes"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-white/50">
                      Price (£)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className={`${inputCls} w-28`}
                        placeholder="optional"
                        aria-label="Edit price in pounds"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm">{s.name}</p>
                      {!s.active && (
                        <span className="text-[10px] uppercase tracking-wide text-white/40 border border-white/15 rounded px-1.5 py-0.5">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-sm mt-1">
                      {formatDuration(s.durationMinutes)} · {formatPrice(s.pricePence)}
                    </p>
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleActive(s)}
                      disabled={busy}
                      className="text-white/40 hover:text-white text-xs font-medium disabled:opacity-40"
                    >
                      {s.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="text-white/40 hover:text-white text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(s.id)}
                      disabled={busy}
                      className="text-red-400/70 hover:text-red-400 text-xs font-medium disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {services.length === 0 && (
        <p className="text-white/30 text-sm">No services yet. Add your first below.</p>
      )}

      <div className="space-y-3 pt-2 border-t border-white/10">
        <p className="text-sm font-medium text-white/70">Add a service</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} w-full`}
          placeholder="e.g. Small tattoo, Consultation"
          maxLength={100}
          aria-label="New service name"
        />
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-white/50">
            Duration (min)
            <input
              type="number"
              min={1}
              max={960}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={`${inputCls} w-24`}
              aria-label="New service duration in minutes"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/50">
            Price (£)
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${inputCls} w-28`}
              placeholder="optional"
              aria-label="New service price in pounds"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !name.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          Add service
        </button>
      </div>
    </div>
  )
}
