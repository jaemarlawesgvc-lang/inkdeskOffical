'use client'

import { useState } from 'react'

interface WaitlistButtonProps {
  artistId: string
  accentColor: string
}

export function WaitlistButton({ artistId, accentColor }: WaitlistButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [flexible, setFlexible] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          clientName: name.trim(),
          clientEmail: email.trim(),
          flexibleOnDate: flexible,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not join waitlist')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join waitlist')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-6 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
        >
          Join Waitlist
        </button>
        <p className="text-white/40 text-xs mt-2">Fully booked for the next two weeks — we&rsquo;ll let you know if something opens up.</p>
      </div>
    )
  }

  if (submitted) {
    return <p className="text-center text-white/60 text-sm">You&rsquo;re on the waitlist. We&rsquo;ll email you if a slot opens up.</p>
  }

  return (
    <div className="max-w-sm mx-auto space-y-3">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50"
      />
      <label className="flex items-center gap-2 text-sm text-white/60">
        <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} className="accent-current" />
        I&rsquo;m flexible on dates
      </label>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="w-full py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
      >
        {submitting ? 'Joining…' : 'Join Waitlist'}
      </button>
    </div>
  )
}
