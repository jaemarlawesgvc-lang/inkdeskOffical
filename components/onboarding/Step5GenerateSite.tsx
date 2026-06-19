'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SiteData } from '@/app/api/onboarding/generate-site/route'
import { StepIntro, WizardNav } from '@/components/onboarding/ui'

interface Step5Props {
  onComplete: () => void
  onBack: () => void
}

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error'

const PROGRESS_STEPS = [
  'Analysing your style tags…',
  'Crafting your brand narrative…',
  'Designing your colour palette…',
  'Writing your service descriptions…',
  'Optimising for search engines…',
  'Finalising your site…',
]

function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-5 shadow-inset-top">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-500">
        {label}
      </p>
      {children}
    </div>
  )
}

export function Step5GenerateSite({ onComplete, onBack }: Step5Props) {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [siteData, setSiteData] = useState<SiteData | null>(null)
  const [progressIndex, setProgressIndex] = useState(0)
  const [progressPct, setProgressPct] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasStarted = useRef(false)

  const startProgress = () => {
    let step = 0
    let pct = 0

    intervalRef.current = setInterval(() => {
      pct += 2
      if (pct > 90) pct = 90 // Hold at 90 until real completion

      setProgressPct(pct)

      if (pct % 15 === 0 && step < PROGRESS_STEPS.length - 1) {
        step++
        setProgressIndex(step)
      }
    }, 400)
  }

  const stopProgress = (finalPct: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setProgressPct(finalPct)
    setProgressIndex(PROGRESS_STEPS.length - 1)
  }

  const generate = async () => {
    setStatus('generating')
    setErrorMessage('')
    setProgressIndex(0)
    setProgressPct(0)
    startProgress()

    try {
      const res = await fetch('/api/onboarding/generate-site', { method: 'POST' })
      const json = (await res.json()) as { ok?: boolean; siteData?: SiteData; error?: string }

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Generation failed')
      }

      stopProgress(100)
      setSiteData(json.siteData ?? null)
      setStatus('done')
    } catch (err) {
      stopProgress(0)
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStatus('error')
    }
  }

  // Auto-start generation on mount
  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    void generate()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Idle / Auto-start (should not show, but safety fallback)
  if (status === 'idle') {
    return (
      <div className="space-y-8">
        <StepIntro
          eyebrow="Step 5 · Go live"
          title="Generate your site"
          description="We'll use AI to compose a custom website from your portfolio and profile."
        />
        <WizardNav
          onBack={onBack}
          submitType="button"
          onSubmit={() => void generate()}
          submitLabel="Generate my site"
        />
      </div>
    )
  }

  // ── Generating
  if (status === 'generating') {
    return (
      <div className="space-y-10">
        <StepIntro
          eyebrow="Step 5 · Go live"
          title="Building your site…"
          description="This usually takes 10–20 seconds. Sit tight."
        />

        {/* Concentric gold spinner */}
        <div className="flex justify-center py-2">
          <div className="relative h-16 w-16" role="status" aria-label="Generating site">
            <div className="absolute inset-0 rounded-full border-2 border-ink-800" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-500" />
            <span className="absolute inset-0 m-auto h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold-500" />
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-ink-300" aria-live="polite">
              {PROGRESS_STEPS[progressIndex]}
            </span>
            <span className="tabular-nums text-gold-400" aria-label={`${progressPct}% complete`}>
              {progressPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Error
  if (status === 'error') {
    return (
      <div className="space-y-8">
        <StepIntro
          eyebrow="Step 5 · Go live"
          title="Generation hit a snag"
          description={errorMessage}
        />
        <WizardNav
          onBack={onBack}
          submitType="button"
          onSubmit={() => void generate()}
          submitLabel="Try again"
        />
      </div>
    )
  }

  // ── Done: preview generated site
  return (
    <div className="space-y-8">
      <StepIntro
        eyebrow="Step 5 · Go live"
        title={
          <span className="inline-flex items-center gap-2.5">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 flex-shrink-0 text-emerald-400" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Your site is ready
          </span>
        }
        description="Here's a preview of what we generated. You can refine every word and colour from your dashboard."
      />

      {siteData && (
        <div className="space-y-4">
          {/* Hero preview — tinted with the generated palette */}
          <div
            className="space-y-1.5 rounded-xl border border-ink-800 p-5 shadow-inset-top"
            style={{
              background: `linear-gradient(135deg, ${siteData.colorScheme.primary}1f, transparent)`,
            }}
          >
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-500">Hero</p>
            <p className="font-display text-lg font-bold leading-tight text-parchment-100">
              {siteData.hero.headline}
            </p>
            <p className="text-sm text-ink-300">{siteData.hero.subheadline}</p>
            <div className="pt-1.5">
              <span
                className="inline-block rounded px-3 py-1 text-xs font-semibold text-white"
                style={{ background: siteData.colorScheme.accent }}
              >
                {siteData.hero.ctaText}
              </span>
            </div>
          </div>

          {/* About */}
          <PreviewCard label="About">
            <p className="font-semibold text-parchment-100">{siteData.about.title}</p>
            <p className="mt-1 line-clamp-3 text-sm text-ink-300">{siteData.about.body}</p>
          </PreviewCard>

          {/* Services */}
          <PreviewCard label="Services">
            <div className="space-y-3">
              {siteData.services.slice(0, 3).map((service, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-parchment-100">{service.name}</p>
                    <p className="line-clamp-1 text-xs text-ink-400">{service.description}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium text-gold-400">
                    {service.priceFrom}
                  </span>
                </div>
              ))}
            </div>
          </PreviewCard>

          {/* Palette */}
          <PreviewCard label="Colour palette">
            <div className="flex flex-wrap gap-4">
              {Object.entries(siteData.colorScheme).map(([name, hex]) => (
                <div key={name} className="flex items-center gap-2">
                  <span
                    className="h-6 w-6 rounded-full border border-ink-700"
                    style={{ background: hex }}
                    aria-label={`${name}: ${hex}`}
                  />
                  <span className="text-xs capitalize text-ink-400">{name}</span>
                </div>
              ))}
            </div>
          </PreviewCard>

          {/* SEO */}
          <PreviewCard label="SEO">
            <p className="text-sm font-medium text-parchment-100">{siteData.seoTitle}</p>
            <p className="mt-1 text-xs text-ink-400">{siteData.seoDescription}</p>
          </PreviewCard>
        </div>
      )}

      <WizardNav submitType="button" onSubmit={onComplete} submitLabel="Go to dashboard" />
    </div>
  )
}
