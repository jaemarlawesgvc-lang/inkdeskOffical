'use client'

import { useEffect, useRef, useState } from 'react'
import type { SiteData } from '@/app/api/onboarding/generate-site/route'

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
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Generate your site</h2>
          <p className="text-white/60 text-sm">
            We&apos;ll use AI to create a custom website from your portfolio and profile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          className="w-full py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-150"
        >
          Generate my site
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 rounded-lg text-sm font-semibold text-white/60 border border-white/20 hover:border-white/50 hover:text-white transition-all duration-150"
        >
          Back
        </button>
      </div>
    )
  }

  // ── Generating
  if (status === 'generating') {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Building your site…</h2>
          <p className="text-white/60 text-sm">This usually takes 10–20 seconds.</p>
        </div>

        {/* Spinner */}
        <div className="flex justify-center py-4">
          <div
            className="w-14 h-14 rounded-full border-4 border-white/10 border-t-white animate-spin"
            role="status"
            aria-label="Generating site"
          />
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-white/40 mb-2">
            <span aria-live="polite">{PROGRESS_STEPS[progressIndex]}</span>
            <span aria-label={`${progressPct}% complete`}>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
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
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Generation failed</h2>
          <p className="text-white/60 text-sm">{errorMessage}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 rounded-lg text-sm font-semibold text-white/60 border border-white/20 hover:border-white/50 hover:text-white transition-all duration-150"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            className="flex-[2] py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-150"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Done: preview generated site
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-emerald-400 flex-shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-2xl font-bold text-white">Your site is ready</h2>
        </div>
        <p className="text-white/60 text-sm">
          Here&apos;s a preview of the content we generated for you. You can customise it anytime
          from your dashboard.
        </p>
      </div>

      {siteData && (
        <div className="space-y-4">
          {/* Hero preview */}
          <div
            className="rounded-xl border border-white/10 p-5 space-y-1"
            style={{ background: siteData.colorScheme.primary + '22' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
              Hero
            </p>
            <p className="text-white font-bold text-lg leading-tight">
              {siteData.hero.headline}
            </p>
            <p className="text-white/60 text-sm">{siteData.hero.subheadline}</p>
            <div className="pt-1">
              <span
                className="inline-block px-3 py-1 rounded text-xs font-semibold text-white"
                style={{ background: siteData.colorScheme.accent }}
              >
                {siteData.hero.ctaText}
              </span>
            </div>
          </div>

          {/* About preview */}
          <div className="rounded-xl border border-white/10 p-5 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">About</p>
            <p className="text-white font-semibold">{siteData.about.title}</p>
            <p className="text-white/60 text-sm line-clamp-3">{siteData.about.body}</p>
          </div>

          {/* Services preview */}
          <div className="rounded-xl border border-white/10 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
              Services
            </p>
            {siteData.services.slice(0, 3).map((service, i) => (
              <div key={i} className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-white text-sm font-medium">{service.name}</p>
                  <p className="text-white/50 text-xs line-clamp-1">{service.description}</p>
                </div>
                <span className="text-white/70 text-xs whitespace-nowrap">{service.priceFrom}</span>
              </div>
            ))}
          </div>

          {/* Colour palette */}
          <div className="rounded-xl border border-white/10 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
              Colour palette
            </p>
            <div className="flex gap-3">
              {Object.entries(siteData.colorScheme).map(([name, hex]) => (
                <div key={name} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border border-white/20"
                    style={{ background: hex }}
                    aria-label={`${name}: ${hex}`}
                  />
                  <span className="text-white/40 text-xs capitalize">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="rounded-xl border border-white/10 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">SEO</p>
            <p className="text-white text-sm font-medium">{siteData.seoTitle}</p>
            <p className="text-white/50 text-xs">{siteData.seoDescription}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onComplete}
        className="w-full py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all duration-150"
      >
        Go to dashboard
      </button>
    </div>
  )
}
