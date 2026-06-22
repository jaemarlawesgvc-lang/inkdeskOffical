'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'

interface ServiceItem {
  name: string
  description: string
  priceFrom: string
}

interface SiteDataShape {
  hero?: { headline?: string; subheadline?: string; ctaText?: string }
  about?: { title?: string; body?: string }
  services?: ServiceItem[]
  seoTitle?: string
  seoDescription?: string
  colorScheme?: { primary?: string; secondary?: string; accent?: string }
}

interface PagePreviewClientProps {
  artistId: string
  siteData: Record<string, unknown> | null
  canRegenerate: boolean
  generationsUsed: number
  generationLimit: number | null
  plan: Plan
}

const PROGRESS_LABELS = [
  'Analysing your style…',
  'Crafting brand narrative…',
  'Designing colour palette…',
  'Writing service descriptions…',
  'Finalising your site…',
]

const inputCls =
  'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/40 transition-colors'

function emptyService(): ServiceItem {
  return { name: '', description: '', priceFrom: '' }
}

// Default palette used when the AI hasn't set colours yet, or as a per-field
// fallback if a user enters an invalid hex value.
const FALLBACK_COLORS = { primary: '#000000', secondary: '#111827', accent: '#F97316' } as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function resolveHexColor(value: string | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback
}

export function PagePreviewClient({
  artistId,
  siteData: initialSiteData,
  canRegenerate,
  generationsUsed,
  generationLimit,
  plan,
}: PagePreviewClientProps) {
  const router = useRouter()
  const [siteData, setSiteData] = useState<SiteDataShape | null>(
    initialSiteData as SiteDataShape | null,
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState(PROGRESS_LABELS[0])
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Edit mode state ──
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<SiteDataShape | null>(null)

  const startProgress = () => {
    let pct = 0
    let labelIdx = 0
    intervalRef.current = setInterval(() => {
      pct = Math.min(pct + 2, 90)
      setProgressPct(pct)
      if (pct % 18 === 0 && labelIdx < PROGRESS_LABELS.length - 1) {
        labelIdx++
        setProgressLabel(PROGRESS_LABELS[labelIdx])
      }
    }, 400)
  }

  const stopProgress = (final: number) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setProgressPct(final)
    setProgressLabel(PROGRESS_LABELS[PROGRESS_LABELS.length - 1])
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const handleRegenerate = async () => {
    if (!canRegenerate || isGenerating) return
    setError(null)
    setIsGenerating(true)
    setProgressPct(0)
    setProgressLabel(PROGRESS_LABELS[0])
    startProgress()

    try {
      const res = await fetch('/api/generate-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId }),
      })
      const json = (await res.json()) as { ok?: boolean; siteData?: SiteDataShape; error?: string }

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Generation failed')
      }

      stopProgress(100)
      setSiteData(json.siteData ?? null)
      router.refresh()
    } catch (err) {
      stopProgress(0)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const startEditing = () => {
    setDraft({
      hero: {
        headline: siteData?.hero?.headline ?? '',
        subheadline: siteData?.hero?.subheadline ?? '',
        ctaText: siteData?.hero?.ctaText ?? 'Book Now',
      },
      about: {
        title: siteData?.about?.title ?? 'About',
        body: siteData?.about?.body ?? '',
      },
      services:
        siteData?.services && siteData.services.length > 0
          ? siteData.services.map((s) => ({ ...s }))
          : [emptyService()],
      seoTitle: siteData?.seoTitle ?? '',
      seoDescription: siteData?.seoDescription ?? '',
      colorScheme: siteData?.colorScheme,
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setDraft(null)
  }

  const updateDraftService = (index: number, field: keyof ServiceItem, value: string) => {
    setDraft((prev) => {
      if (!prev?.services) return prev
      const next = [...prev.services]
      next[index] = { ...next[index], [field]: value } as ServiceItem
      return { ...prev, services: next }
    })
  }

  const addService = () => {
    setDraft((prev) =>
      prev ? { ...prev, services: [...(prev.services ?? []), emptyService()] } : prev,
    )
  }

  const removeService = (index: number) => {
    setDraft((prev) => {
      if (!prev?.services) return prev
      return { ...prev, services: prev.services.filter((_, i) => i !== index) }
    })
  }

  const handleSave = async () => {
    if (!draft) return

    const cleanedServices = (draft.services ?? []).filter(
      (s) => s.name.trim() && s.description.trim() && s.priceFrom.trim(),
    )

    if (cleanedServices.length === 0) {
      toast.error('Add at least one service with a name, description, and price.')
      return
    }
    if (cleanedServices.length > 10) {
      toast.error('You can list a maximum of 10 services.')
      return
    }

    const headline = draft.hero?.headline?.trim() || 'Custom tattoos by appointment'
    const aboutBody = draft.about?.body?.trim() || 'Custom tattoos by a professional artist.'

    // Per-field validation: keep each valid hex, fall back individually so one
    // mistyped value doesn't reset the whole palette.
    const colorScheme = {
      primary: resolveHexColor(draft.colorScheme?.primary, FALLBACK_COLORS.primary),
      secondary: resolveHexColor(draft.colorScheme?.secondary, FALLBACK_COLORS.secondary),
      accent: resolveHexColor(draft.colorScheme?.accent, FALLBACK_COLORS.accent),
    }

    const payloadSiteData = {
      hero: {
        headline,
        subheadline: draft.hero?.subheadline?.trim() || 'Book your next piece today.',
        ctaText: draft.hero?.ctaText?.trim() || 'Book Now',
      },
      about: {
        title: draft.about?.title?.trim() || 'About',
        body: aboutBody,
      },
      services: cleanedServices,
      seoTitle: (draft.seoTitle?.trim() || headline).slice(0, 70),
      seoDescription: (draft.seoDescription?.trim() || aboutBody).slice(0, 160),
      colorScheme,
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, siteData: payloadSiteData }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to save site content')
      }

      setSiteData(payloadSiteData)
      toast.success('Page content saved!')
      setIsEditing(false)
      setDraft(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Generation controls */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-white font-semibold text-sm">AI Site Generation</p>
            <p className="text-white/40 text-xs mt-0.5">
              {generationLimit !== null
                ? `${generationsUsed} of ${generationLimit} used this month`
                : `${generationsUsed} used this month (unlimited on ${PLAN_DISPLAY[plan].name})`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRegenerate()}
            disabled={!canRegenerate || isGenerating || isEditing}
            title={!canRegenerate ? 'Monthly generation limit reached — upgrade to get more' : undefined}
            className={[
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
              canRegenerate && !isGenerating && !isEditing
                ? 'bg-white text-black hover:bg-white/90 active:scale-95'
                : 'bg-white/10 text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              'Regenerate site'
            )}
          </button>
        </div>

        {!canRegenerate && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Monthly generation limit reached.{' '}
            <a href="/dashboard/settings#billing" className="underline">Upgrade your plan</a> for more.
          </div>
        )}

        {/* Progress bar */}
        {isGenerating && (
          <div>
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span aria-live="polite">{progressLabel}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm" role="alert">{error}</p>
        )}
      </div>

      {/* Edit toggle bar */}
      {siteData && !isGenerating && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">
            {isEditing ? 'Edit the text on your live page.' : 'Want to tweak the wording yourself?'}
          </p>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              Edit text
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Edit form ── */}
      {isEditing && draft ? (
        <div className="space-y-4">
          {/* Hero */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Hero</p>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Headline</label>
              <input
                type="text"
                value={draft.hero?.headline ?? ''}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, hero: { ...prev.hero, headline: e.target.value } })
                }
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Subheadline</label>
              <textarea
                value={draft.hero?.subheadline ?? ''}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, hero: { ...prev.hero, subheadline: e.target.value } })
                }
                maxLength={300}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Button text</label>
              <input
                type="text"
                value={draft.hero?.ctaText ?? ''}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, hero: { ...prev.hero, ctaText: e.target.value } })
                }
                maxLength={40}
                className={`${inputCls} max-w-xs`}
              />
            </div>
          </div>

          {/* About */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">About</p>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Section title</label>
              <input
                type="text"
                value={draft.about?.title ?? ''}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, about: { ...prev.about, title: e.target.value } })
                }
                maxLength={60}
                className={`${inputCls} max-w-xs`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Body</label>
              <textarea
                value={draft.about?.body ?? ''}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, about: { ...prev.about, body: e.target.value } })
                }
                maxLength={1000}
                rows={5}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Services */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Services</p>
              <button
                type="button"
                onClick={addService}
                className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                + Add service
              </button>
            </div>
            {(draft.services ?? []).map((service, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_3fr_1fr_auto] gap-2 items-start">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => updateDraftService(i, 'name', e.target.value)}
                  placeholder="Service name"
                  maxLength={80}
                  className={inputCls}
                />
                <input
                  type="text"
                  value={service.description}
                  onChange={(e) => updateDraftService(i, 'description', e.target.value)}
                  placeholder="Description"
                  maxLength={200}
                  className={inputCls}
                />
                <input
                  type="text"
                  value={service.priceFrom}
                  onChange={(e) => updateDraftService(i, 'priceFrom', e.target.value)}
                  placeholder="From £100"
                  maxLength={30}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeService(i)}
                  aria-label="Remove service"
                  className="self-center text-white/30 hover:text-red-400 transition-colors p-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* SEO */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">SEO</p>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Page title</label>
              <input
                type="text"
                value={draft.seoTitle ?? ''}
                onChange={(e) => setDraft((prev) => prev && { ...prev, seoTitle: e.target.value })}
                maxLength={70}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Meta description</label>
              <textarea
                value={draft.seoDescription ?? ''}
                onChange={(e) => setDraft((prev) => prev && { ...prev, seoDescription: e.target.value })}
                maxLength={160}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </div>
      ) : siteData ? (
        <div className="space-y-4">
          {/* Hero */}
          {siteData.hero && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Hero</p>
              <p className="text-white font-bold text-lg leading-tight">{siteData.hero.headline}</p>
              <p className="text-white/60 text-sm">{siteData.hero.subheadline}</p>
              {siteData.hero.ctaText && (
                <span className="inline-block mt-1 px-3 py-1 rounded text-xs font-semibold text-white bg-white/20">
                  {siteData.hero.ctaText}
                </span>
              )}
            </div>
          )}

          {/* About */}
          {siteData.about && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">About</p>
              <p className="text-white font-semibold">{siteData.about.title}</p>
              <p className="text-white/60 text-sm line-clamp-3">{siteData.about.body}</p>
            </div>
          )}

          {/* Services */}
          {siteData.services && siteData.services.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Services</p>
              {siteData.services.slice(0, 4).map((service, i) => (
                <div key={i} className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-white text-sm font-medium">{service.name}</p>
                    <p className="text-white/50 text-xs line-clamp-1">{service.description}</p>
                  </div>
                  <span className="text-white/60 text-xs whitespace-nowrap">{service.priceFrom}</span>
                </div>
              ))}
            </div>
          )}

          {/* SEO */}
          {(siteData.seoTitle || siteData.seoDescription) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">SEO</p>
              {siteData.seoTitle && <p className="text-white text-sm font-medium">{siteData.seoTitle}</p>}
              {siteData.seoDescription && <p className="text-white/50 text-xs">{siteData.seoDescription}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-12 text-center">
          <p className="text-white/40 text-sm">No site generated yet.</p>
          <p className="text-white/25 text-xs mt-1">Click &ldquo;Regenerate site&rdquo; above to generate your page.</p>
        </div>
      )}
    </div>
  )
}
