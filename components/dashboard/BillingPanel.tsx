'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type Plan, PLAN_DISPLAY } from '@/lib/stripe/plans'
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/constants'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'

interface BillingPanelProps {
  plan: Plan
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  checkout: 'success' | 'cancelled' | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const PRO_INCLUDES = [
  'Unlimited portfolio images',
  'Unlimited bookings every month',
  'Stripe deposit collection',
  'Automated reminders & aftercare',
  'Full client notes & history',
  'CSV export of clients & bookings',
]

const STUDIO_EXTRAS = ['Unlimited AI site regenerations', 'Priority support']

const FREE_TEASERS: { title: string; copy: string }[] = [
  { title: 'Take deposits', copy: 'Collect upfront via Stripe — paid straight to your bank.' },
  { title: 'Never lose a lead', copy: 'Unlimited bookings and an unlimited portfolio.' },
  { title: 'Automate the admin', copy: 'Reminder and aftercare emails sent for you.' },
  { title: 'Know your clients', copy: 'Full notes, history and CSV export.' },
]

export function BillingPanel({
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  checkout,
}: BillingPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<'success' | 'cancelled' | null>(checkout)

  const isFree = plan === 'free'
  const isTrialing = status === 'trialing'
  const isPastDue = status === 'past_due'
  const display = PLAN_DISPLAY[plan]

  const handleManageBilling = async () => {
    setBillingLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) window.location.href = json.url
      else setError(json.error ?? 'Could not open the billing portal.')
    } catch {
      setError('Could not reach the billing service.')
    } finally {
      setBillingLoading(false)
    }
  }

  // Renewal / trial status line
  let periodLine: string | null = null
  if (!isFree && currentPeriodEnd) {
    if (isTrialing) periodLine = `Free trial — first payment on ${formatDate(currentPeriodEnd)}`
    else if (cancelAtPeriodEnd) periodLine = `Cancels on ${formatDate(currentPeriodEnd)}`
    else periodLine = `Renews on ${formatDate(currentPeriodEnd)}`
  }

  const statusPill = isFree
    ? { label: 'Free', cls: 'bg-white/10 text-white/60' }
    : isTrialing
      ? { label: 'Trialing', cls: 'bg-gold-500/15 text-gold-400 border border-gold-500/30' }
      : isPastDue
        ? { label: 'Past due', cls: 'bg-crimson-500/15 text-crimson-400 border border-crimson-500/30' }
        : { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="text-white/40 transition-colors hover:text-white/70"
          aria-label="Back to settings"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Billing</h1>
          <p className="mt-0.5 text-sm text-white/40">Manage your plan and payment details.</p>
        </div>
      </div>

      {/* Post-checkout banners */}
      {banner === 'success' && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-emerald-100">
              <span className="font-semibold">You&apos;re all set.</span> Your {SUBSCRIPTION_TRIAL_DAYS}-day
              free trial has started — explore everything, you won&apos;t be charged until it ends.
            </p>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="text-emerald-400/60 hover:text-emerald-300" aria-label="Dismiss">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </div>
      )}
      {banner === 'cancelled' && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
          <p className="text-sm text-white/60">
            Checkout was cancelled — no charge was made. You can upgrade whenever you&apos;re ready.
          </p>
          <button type="button" onClick={() => setBanner(null)} className="text-white/30 hover:text-white/60" aria-label="Dismiss">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </div>
      )}

      {/* Past-due alert */}
      {isPastDue && (
        <div className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 px-4 py-3.5 text-sm text-crimson-400">
          <span className="font-semibold text-crimson-400">Payment failed.</span> Update your card in the
          billing portal to keep your {display.name} features active.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400" role="alert">
          {error}
        </div>
      )}

      {/* ── Current plan card ── */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6 sm:p-7',
          isFree ? 'border-white/10 bg-white/5' : 'border-gold-500/30 bg-gradient-surface shadow-inset-top',
        )}
      >
        {!isFree && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-500/[0.07] blur-3xl" />
          </>
        )}

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/40">Current plan</p>
            <div className="mt-1.5 flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-white">{display.name}</h2>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusPill.cls)}>
                {statusPill.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/50">
              {display.price} · {display.description}
            </p>
            {periodLine && <p className="mt-2 text-xs text-gold-400/90">{periodLine}</p>}
          </div>

          <div className="flex-shrink-0">
            {isFree ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-gold transition-all duration-200 hover:bg-gold-400 active:bg-gold-600"
              >
                Start {SUBSCRIPTION_TRIAL_DAYS}-day free trial
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={billingLoading}
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                {billingLoading ? 'Opening…' : 'Manage billing'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Free: what you're missing ── */}
      {isFree && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-lg font-bold text-white">Everything unlocks on Pro</h3>
            <span className="text-sm text-white/40">
              from <span className="font-semibold text-gold-400">£19/mo</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-white/45">
            Try it free for {SUBSCRIPTION_TRIAL_DAYS} days — card required, no charge until the trial ends.
          </p>

          {/* Bento value props */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FREE_TEASERS.map((t, i) => (
              <div
                key={t.title}
                className={cn(
                  'rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-gold-500/25',
                  i === 0 && 'sm:row-span-1',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold-500/10 text-gold-500">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/45">{t.copy}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-gold transition-all duration-200 hover:bg-gold-400 active:bg-gold-600"
          >
            See plans &amp; start free trial
          </button>
        </div>
      )}

      {/* ── Paid: what's included ── */}
      {!isFree && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
          <h3 className="font-display text-lg font-bold text-white">What&apos;s included</h3>
          <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[...PRO_INCLUDES, ...(plan === 'studio' ? STUDIO_EXTRAS : [])].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-500" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          {plan === 'pro' && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-5 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-300"
            >
              Compare with Studio →
            </button>
          )}
        </div>
      )}

      <p className="text-center text-xs text-white/30">
        Payments are processed securely by Stripe. Inkquire never takes a commission on your bookings.
      </p>

      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={plan === 'pro' ? 'Compare plans' : 'Unlock the full studio'}
        reason={
          plan === 'pro'
            ? 'You’re on Pro. Studio adds unlimited AI regenerations and priority support.'
            : undefined
        }
      />
    </div>
  )
}
