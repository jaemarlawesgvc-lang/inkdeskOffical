'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Plan content — curated, editorial copy (not raw limit dumps)
// ---------------------------------------------------------------------------

type PaidPlan = 'pro' | 'studio'

interface PlanCard {
  id: PaidPlan
  name: string
  price: string
  cadence: string
  tagline: string
  highlights: string[]
  recommended?: boolean
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '£19',
    cadence: '/month',
    tagline: 'For working artists ready to fill the calendar.',
    recommended: true,
    highlights: [
      'Unlimited portfolio images',
      'Unlimited bookings every month',
      'Collect deposits via Stripe — paid straight to you',
      'Automated reminders & aftercare emails',
      'Full client notes & history',
      'CSV export of clients & bookings',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '£49',
    cadence: '/month',
    tagline: 'For studios and high-volume artists.',
    highlights: [
      'Everything in Pro',
      'Unlimited AI site regenerations',
      'Priority support',
    ],
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Short context line explaining why the upgrade is being offered. */
  reason?: string
  /** Headline override. */
  title?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradeModal({ open, onClose, reason, title }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lock body scroll + Escape to close while open
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const startCheckout = useCallback(async (plan: PaidPlan) => {
    setError(null)
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = (await res.json()) as { url?: string; error?: string }

      if (res.ok && json.url) {
        window.location.href = json.url
        return
      }
      setError(json.error ?? 'Could not start checkout. Please try again.')
    } catch {
      setError('Could not reach the billing service. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close upgrade dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/80 backdrop-blur-sm motion-safe:animate-fade-in"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-gold-500/20 bg-ink-950 shadow-gold-lg motion-safe:animate-scale-in">
        {/* Ambient layers */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-50" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/[0.08] blur-3xl"
        />

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-800 hover:text-parchment-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        <div className="relative z-10 p-6 sm:p-8">
          {/* Header */}
          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-400">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              {SUBSCRIPTION_TRIAL_DAYS} days free
            </span>
            <h2
              id="upgrade-modal-title"
              className="mt-4 font-display text-2xl font-bold leading-tight text-parchment-100 sm:text-3xl"
            >
              {title ?? 'Unlock the full studio'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">
              {reason ??
                'Start a free trial today — no charge for ' +
                  `${SUBSCRIPTION_TRIAL_DAYS} days, cancel anytime before it ends.`}
            </p>
          </div>

          {/* Plan cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLAN_CARDS.map((plan) => {
              const isLoading = loadingPlan === plan.id
              const anyLoading = loadingPlan !== null

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col rounded-xl border p-5',
                    plan.recommended
                      ? 'border-gold-500/40 bg-gradient-surface shadow-inset-top'
                      : 'border-ink-800 bg-ink-900/40',
                  )}
                >
                  {plan.recommended && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-gold-500 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-950">
                      Recommended
                    </span>
                  )}

                  <div className="mb-3">
                    <h3 className="font-display text-lg font-bold text-parchment-100">{plan.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-400">{plan.tagline}</p>
                  </div>

                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-parchment-100">{plan.price}</span>
                    <span className="text-sm text-ink-500">{plan.cadence}</span>
                    <span className="ml-2 text-xs font-medium text-gold-400">
                      after {SUBSCRIPTION_TRIAL_DAYS}-day trial
                    </span>
                  </div>

                  <ul className="mb-5 space-y-2.5">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-parchment-300">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className={cn(
                            'mt-0.5 h-4 w-4 flex-shrink-0',
                            plan.recommended ? 'text-gold-500' : 'text-ink-400',
                          )}
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {h}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => void startCheckout(plan.id)}
                    disabled={anyLoading}
                    className={cn(
                      'mt-auto inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-60',
                      plan.recommended
                        ? 'bg-gold-500 text-ink-950 shadow-gold hover:bg-gold-400 active:bg-gold-600'
                        : 'border border-ink-600 bg-ink-800 text-parchment-100 hover:border-ink-500 hover:bg-ink-700',
                    )}
                  >
                    {isLoading && (
                      <svg className="-ml-1 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {isLoading ? 'Opening checkout…' : `Start ${SUBSCRIPTION_TRIAL_DAYS}-day free trial`}
                  </button>
                </div>
              )
            })}
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 text-sm text-crimson-400" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-xs text-ink-600">
            No charge for {SUBSCRIPTION_TRIAL_DAYS} days · No commission on your bookings · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
