'use client'

/**
 * components/dashboard/DashboardTour.tsx
 *
 * First-run experience for the dashboard:
 *   1. A snappy welcome popup ("Take a quick tour?") on first visit.
 *   2. If accepted, a spotlight walkthrough that highlights each sidebar button
 *      one at a time with a one-line explanation, finishing on "Get help".
 *
 * Targets are matched by `data-tour="…"` attributes on the Sidebar / TopBar.
 * Any step whose target isn't on screen (e.g. the desktop sidebar on a mobile
 * viewport) is skipped automatically. Skippable at any point; shows once
 * (tracked in localStorage).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'inkdesk_dashboard_tour_v1'

interface TourStep {
  /** First visible match wins. */
  selectors: string[]
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    selectors: ['[data-tour="nav-overview"]'],
    title: 'Overview',
    body: 'Your home base — key stats and upcoming bookings at a glance.',
  },
  {
    selectors: ['[data-tour="nav-bookings"]'],
    title: 'Bookings',
    body: 'Incoming booking requests land here. Confirm or decline them in a tap.',
  },
  {
    selectors: ['[data-tour="nav-clients"]'],
    title: 'Clients',
    body: 'Your saved client list and their history.',
  },
  {
    selectors: ['[data-tour="nav-portfolio"]'],
    title: 'Portfolio',
    body: 'Upload and reorder your tattoo photos — drag and drop to arrange.',
  },
  {
    selectors: ['[data-tour="nav-edit"]'],
    title: 'Edit my page',
    body: 'The main editor for your public page — bio, colours, background, pricing.',
  },
  {
    selectors: ['[data-tour="nav-analytics"]'],
    title: 'Analytics',
    body: 'Track page views and booking stats over time.',
  },
  {
    selectors: ['[data-tour="nav-messages"]'],
    title: 'Messages',
    body: 'Chat directly with your clients.',
  },
  {
    selectors: ['[data-tour="nav-consent"]'],
    title: 'Consent Forms',
    body: 'Submitted client consent forms — search, filter, sort and export.',
  },
  {
    selectors: ['[data-tour="nav-waitlist"]'],
    title: 'Waitlist',
    body: 'People who joined while you were fully booked.',
  },
  {
    selectors: ['[data-tour="nav-settings"]'],
    title: 'Settings',
    body: 'Billing, notifications, and account & security.',
  },
  {
    selectors: ['[data-tour="nav-live"]'],
    title: 'View live page',
    body: 'Open your public booking page in a new tab to see what clients see.',
  },
  {
    selectors: ['[data-tour="help"]'],
    title: 'Stuck on anything?',
    body: 'The AI assistant can help with anything in Inkquire — just ask.',
  },
]

const PAD = 8 // spotlight padding around the target

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function firstVisible(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el && el.getClientRects().length > 0) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

export function DashboardTour() {
  const [mounted, setMounted] = useState(false)
  // phase: 'welcome' shows the intro popup, 'tour' runs the spotlight, null = closed
  const [phase, setPhase] = useState<'welcome' | 'tour' | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setPhase('welcome')
    } catch {
      /* localStorage unavailable — just don't auto-show */
    }
  }, [])

  const finish = useCallback(() => {
    setPhase(null)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  // Resolve the next/prev step that actually has a visible target.
  const resolveFrom = useCallback((from: number, dir: 1 | -1): number => {
    let i = from
    while (i >= 0 && i < STEPS.length) {
      if (firstVisible(STEPS[i]!.selectors)) return i
      i += dir
    }
    return -1
  }, [])

  const measure = useCallback(() => {
    const el = targetRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [])

  useLayoutEffect(() => {
    if (phase !== 'tour') return
    const el = firstVisible(STEPS[stepIndex]!.selectors)
    targetRef.current = el
    if (!el) {
      const next = resolveFrom(stepIndex + 1, 1)
      if (next === -1) finish()
      else setStepIndex(next)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(measure, 200)
    return () => clearTimeout(t)
  }, [phase, stepIndex, measure, resolveFrom, finish])

  useEffect(() => {
    if (phase !== 'tour') return
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [phase, measure])

  useEffect(() => {
    if (!phase) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, finish])

  const startTour = () => {
    const first = resolveFrom(0, 1)
    if (first === -1) {
      finish()
      return
    }
    setStepIndex(first)
    setPhase('tour')
  }

  const next = () => {
    const n = resolveFrom(stepIndex + 1, 1)
    if (n === -1) finish()
    else setStepIndex(n)
  }

  const back = () => {
    const p = resolveFrom(stepIndex - 1, -1)
    if (p !== -1) setStepIndex(p)
  }

  if (!mounted || !phase) return null

  // ── Welcome popup ──────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return createPortal(
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to your dashboard"
      >
        <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={finish} />
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold-500/20 bg-ink-900 p-6 text-center shadow-2xl motion-safe:animate-scale-in">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gold-500/10 blur-3xl"
          />
          <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-400">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6" aria-hidden="true">
              <path d="M10 1.5l1.9 5.1 5.1 1.9-5.1 1.9L10 15.5l-1.9-5.1L3 8.5l5.1-1.9L10 1.5z" />
            </svg>
          </span>
          <h2 className="relative mt-4 font-display text-xl font-bold text-parchment-100">
            Welcome to your dashboard
          </h2>
          <p className="relative mt-2 text-sm leading-relaxed text-ink-400">
            Want a quick tour? We&apos;ll point out each button so you know exactly where
            everything lives. Takes about 30 seconds.
          </p>
          <div className="relative mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={startTour}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-5 py-3 text-sm font-bold text-ink-950 shadow-gold transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
            >
              Show me around
            </button>
            <button
              type="button"
              onClick={finish}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-ink-400 transition-colors hover:text-parchment-100"
            >
              Skip — I&apos;ll explore myself
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // ── Spotlight tour ─────────────────────────────────────────────────────────
  if (!rect) {
    return createPortal(<div className="fixed inset-0 z-[90] bg-ink-950/60" />, document.body)
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const boxTop = rect.top - PAD
  const boxLeft = rect.left - PAD
  const boxW = rect.width + PAD * 2
  const boxH = rect.height + PAD * 2

  const TOOLTIP_W = Math.min(320, vw - 24)
  // Sidebar items are tall-and-narrow on the left — prefer placing the tooltip
  // to the right of the target; fall back to below, then above.
  const spaceRight = vw - (rect.left + rect.width)
  const placeRight = spaceRight > TOOLTIP_W + 24
  const placeBelow = !placeRight && rect.top + rect.height + 14 + 170 < vh

  let tipTop: number
  let tipLeft: number
  let tipTransform: string | undefined
  if (placeRight) {
    tipTop = Math.max(12, Math.min(rect.top, vh - 180))
    tipLeft = rect.left + rect.width + PAD + 12
  } else if (placeBelow) {
    tipTop = rect.top + rect.height + PAD + 12
    tipLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 12))
  } else {
    tipTop = rect.top - PAD - 12
    tipLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 12))
    tipTransform = 'translateY(-100%)'
  }

  const visibleTotal = STEPS.filter((s) => firstVisible(s.selectors)).length
  const visiblePos = STEPS.slice(0, stepIndex + 1).filter((s) => firstVisible(s.selectors)).length

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Dashboard tour">
      {/* Spotlight: transparent hole + giant shadow dimming everything else */}
      <div
        className="pointer-events-none absolute rounded-xl ring-2 ring-gold-500/80 transition-all duration-200"
        style={{
          top: boxTop,
          left: boxLeft,
          width: boxW,
          height: boxH,
          boxShadow: '0 0 0 9999px rgba(8,8,8,0.78)',
        }}
      />

      {/* Click-catcher to dismiss when tapping the dimmed area */}
      <button
        type="button"
        aria-label="Skip tour"
        onClick={finish}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      {/* Tooltip */}
      <div
        className="absolute rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-2xl motion-safe:animate-fade-up"
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_W, transform: tipTransform }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-parchment-100">
            {STEPS[stepIndex]!.title}
          </h3>
          <span className="mt-0.5 flex-shrink-0 text-[0.7rem] font-semibold uppercase tracking-wider text-gold-500">
            {visiblePos} / {visibleTotal}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{STEPS[stepIndex]!.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-semibold text-ink-500 transition-colors hover:text-parchment-200"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {visiblePos > 1 && (
              <button
                type="button"
                onClick={back}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-semibold text-parchment-300 transition-colors hover:border-ink-500 hover:text-parchment-100"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-gold-500 px-4 py-1.5 text-xs font-bold text-ink-950 shadow-gold transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              {visiblePos >= visibleTotal ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
