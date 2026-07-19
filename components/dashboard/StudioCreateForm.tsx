'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const inputCls =
  'bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

/**
 * Shown to a Studio-plan artist who does not yet own a studio. Creates one
 * via POST /api/studio, then refreshes the page into the management view.
 */
export function StudioCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Give your studio a name')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not create studio')
      toast.success('Studio created')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create studio')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 max-w-lg">
      <h2 className="text-white font-semibold">Create your studio</h2>
      <p className="text-white/40 text-sm mt-1">
        Set up a studio to invite artists, see a shared calendar, and track commission and
        booth-rent owed to the studio.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} w-full`}
          placeholder="Studio name, e.g. Black Anchor Collective"
          maxLength={120}
          aria-label="Studio name"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={busy || !name.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          {busy ? 'Creating…' : 'Create studio'}
        </button>
      </div>
    </section>
  )
}
