'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface StudioConnectCardProps {
  /** studios.stripe_connect_status — 'none' | 'pending' | 'verified'. */
  status: string
  /** Whether a studios.stripe_connect_account_id already exists. */
  hasAccount: boolean
}

/**
 * Studio-owner card to connect the studio's own Stripe payout account — the
 * account that receives automated commission transfers from the platform when a
 * studio artist collects a deposit/balance. Distinct from each artist's own
 * connected account (which still receives the client's payment in full).
 */
export function StudioConnectCard({ status, hasAccount }: StudioConnectCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [connectStatus, setConnectStatus] = useState(status)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_connect') === 'success') {
      toast.success('Studio payout onboarding completed. Verification may take a moment.')
      setConnectStatus((prev) => (prev === 'verified' ? prev : 'pending'))
      router.replace('/dashboard/studio')
    } else if (params.get('stripe_connect') === 'refresh') {
      toast.error('Studio payout setup was interrupted. Please try again.')
      router.replace('/dashboard/studio')
    }
  }, [router])

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/studio/connect-onboarding', { method: 'POST' })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) {
        window.location.href = json.url
      } else {
        toast.error(json.error ?? 'Could not create onboarding link')
      }
    } catch {
      toast.error('Could not initiate studio payout connection')
    } finally {
      setLoading(false)
    }
  }

  const isVerified = connectStatus === 'verified'
  const isPending = connectStatus === 'pending' || (hasAccount && !isVerified)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-white text-sm font-medium">Studio payout account</p>
          <p className="text-white/40 text-xs mt-0.5 max-w-md">
            Connect the studio&rsquo;s Stripe account to automatically receive your
            commission whenever a studio artist collects a deposit or balance.
          </p>
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ' +
            (isVerified
              ? 'bg-emerald-500/15 text-emerald-300'
              : isPending
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-white/10 text-white/50')
          }
        >
          {isVerified ? 'Connected' : isPending ? 'Pending verification' : 'Not connected'}
        </span>
      </div>

      {!isVerified && (
        <button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-white text-black text-sm font-medium px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? 'Redirecting…'
            : isPending
              ? 'Finish payout setup'
              : 'Connect payouts'}
        </button>
      )}

      {isVerified && (
        <p className="text-white/40 text-xs">
          Your studio is set up to receive commission payouts automatically.
        </p>
      )}
    </div>
  )
}
