'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AcceptInviteButtonProps {
  token: string
}

/**
 * Calls POST /api/studio/accept-invite with the invite token, then routes the
 * newly-active member to their studio dashboard on success.
 */
export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not accept the invitation. Please try again.')
        setPending(false)
        return
      }
      router.push('/dashboard/studio')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return (
    <div>
      {error && (
        <div
          className="mb-4 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
          role="alert"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Accepting…' : 'Accept invitation'}
      </button>
    </div>
  )
}
