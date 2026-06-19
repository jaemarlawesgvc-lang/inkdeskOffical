'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'

// ---------------------------------------------------------------------------
// ProBadge — small inline "Pro" chip for labelling gated controls
// ---------------------------------------------------------------------------

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-gold-400',
        className,
      )}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 1l2.39 4.84 5.34.78-3.86 3.77.91 5.32L10 13.99l-4.78 2.52.91-5.32L2.27 6.62l5.34-.78L10 1z"
          clipRule="evenodd"
        />
      </svg>
      Pro
    </span>
  )
}

// ---------------------------------------------------------------------------
// LockedFeature — premium "this feature lives on Pro" surface
// ---------------------------------------------------------------------------

interface LockedFeatureProps {
  title: string
  description: string
  /** Context line passed through to the upgrade modal. */
  reason?: string
  /** CTA label. Defaults to "Upgrade to Pro". */
  cta?: string
  /**
   * When provided, the children are rendered behind a frosted overlay (a
   * teaser of what's locked). When omitted, a standalone card is rendered.
   */
  children?: ReactNode
  className?: string
}

export function LockedFeature({
  title,
  description,
  reason,
  cta = 'Upgrade to Pro',
  children,
  className,
}: LockedFeatureProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const lockMark = (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-500 shadow-gold">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z" />
      </svg>
    </span>
  )

  const cardBody = (
    <div className="flex max-w-sm flex-col items-center text-center">
      {lockMark}
      <h3 className="mt-4 font-display text-lg font-bold text-parchment-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{description}</p>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-gold transition-all duration-200 hover:bg-gold-400 active:bg-gold-600"
      >
        {cta}
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )

  return (
    <>
      {children ? (
        // Teaser mode: blurred content behind a frosted gold-edged overlay
        <div className={cn('relative overflow-hidden rounded-2xl border border-ink-800', className)}>
          <div aria-hidden className="pointer-events-none select-none opacity-30 blur-[3px]">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70 p-6 backdrop-blur-[2px]">
            {cardBody}
          </div>
        </div>
      ) : (
        // Standalone card
        <div
          className={cn(
            'relative flex items-center justify-center overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40 px-6 py-12',
            className,
          )}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gold-500/[0.06] blur-3xl"
          />
          <div className="relative z-10">{cardBody}</div>
        </div>
      )}

      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        reason={reason ?? description}
      />
    </>
  )
}
