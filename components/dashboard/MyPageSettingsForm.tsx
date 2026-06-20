'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { STYLE_TAG_OPTIONS } from '@/lib/validations/onboarding'
import { StudioLocationPicker } from '@/components/dashboard/StudioLocationPicker'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface MyPageData {
  displayName: string
  bio: string
  styleTags: string[]
  instagramHandle: string
  studioName: string
  studioAddress: string
  studioLat: number | null
  studioLng: number | null
  hourlyRate: number | null
  depositAmount: number | null
  depositRequired: boolean
  pricingNotes: string
  priceTier: string
  timezone: string
  availability: AvailabilitySlot[]
  colorScheme: { primary: string; secondary: string; accent: string }
  backgroundImageUrl: string
}

interface MyPageSettingsFormProps {
  artistId: string
  initialData: MyPageData
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DEBOUNCE_MS = 1500

const HEX_RE = /^#[0-9a-fA-F]{6}$/
// Default palette mirrors the InkDesk home page theme (ink-950 / ink-800 / gold-500).
// Artists can change these, but a fresh page ships with the signature look.
const FALLBACK_COLORS = { primary: '#080808', secondary: '#1a1a1a', accent: '#ffb700' } as const

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const COLOR_FIELDS = [
  { key: 'accent', label: 'Accent', hint: 'Buttons, links & highlights' },
  { key: 'primary', label: 'Primary', hint: 'Page background' },
  { key: 'secondary', label: 'Secondary', hint: 'Background tint & surfaces' },
] as const

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="text-white/40 text-sm mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-white/70">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

export function MyPageSettingsForm({ artistId, initialData }: MyPageSettingsFormProps) {
  const router = useRouter()
  const [data, setData] = useState<MyPageData>(initialData)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Refs for debouncing + cancelling in-flight requests
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const isFirstRender = useRef(true)
  const latestData = useRef(data)

  useEffect(() => {
    latestData.current = data
  }, [data])

  const performSave = useCallback(async () => {
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller

    setStatus('saving')
    setErrorMessage(null)

    // Coerce any mid-typed/invalid hex to a valid fallback so the strict API
    // validation never rejects an auto-save while the user is still editing.
    const cs = latestData.current.colorScheme
    const safeColorScheme = {
      primary: HEX_RE.test(cs.primary) ? cs.primary : FALLBACK_COLORS.primary,
      secondary: HEX_RE.test(cs.secondary) ? cs.secondary : FALLBACK_COLORS.secondary,
      accent: HEX_RE.test(cs.accent) ? cs.accent : FALLBACK_COLORS.accent,
    }

    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latestData.current, artistId, colorScheme: safeColorScheme }),
        signal: controller.signal,
      })
      const json = (await res.json()) as { error?: string }

      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`)

      setStatus('saved')
      setLastSavedAt(new Date())
      router.refresh()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof Error ? err.message : 'Save failed'
      setStatus('error')
      setErrorMessage(message)
      toast.error(message)
    }
  }, [artistId, router])

  // Debounced auto-save: triggers DEBOUNCE_MS after the last change.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      void performSave()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [data, performSave])

  // Cleanup on unmount: cancel any pending timer and in-flight request.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      abortController.current?.abort()
    }
  }, [])

  const set = <K extends keyof MyPageData>(key: K, value: MyPageData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const updateColor = (key: 'primary' | 'secondary' | 'accent', value: string) => {
    setData((prev) => ({ ...prev, colorScheme: { ...prev.colorScheme, [key]: value } }))
  }

  // ── Custom background image ──
  const [bgUploading, setBgUploading] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  const handleBackgroundFile = async (file: File | null | undefined) => {
    if (!file) return
    setBgError(null)

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setBgError('Background must be a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setBgError('Background image must be under 10MB.')
      return
    }

    setBgUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      // Stored in the existing public portfolio-images bucket under the artist's
      // own folder (same RLS path as portfolio uploads) — no new bucket needed.
      const path = `${artistId}/background-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('portfolio-images')
        .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('portfolio-images').getPublicUrl(path)
      // Setting this triggers the debounced auto-save, which persists the URL.
      set('backgroundImageUrl', urlData.publicUrl)
      toast.success('Background uploaded')
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setBgUploading(false)
      if (bgInputRef.current) bgInputRef.current.value = ''
    }
  }

  const toggleStyleTag = (tag: string) => {
    const next = data.styleTags.includes(tag)
      ? data.styleTags.filter((t) => t !== tag)
      : [...data.styleTags, tag]
    set('styleTags', next)
  }

  const toggleDay = (dayIndex: number) => {
    const exists = data.availability.find((s) => s.dayOfWeek === dayIndex)
    if (exists) {
      set('availability', data.availability.filter((s) => s.dayOfWeek !== dayIndex))
    } else {
      set('availability', [
        ...data.availability,
        { dayOfWeek: dayIndex, startTime: '09:00', endTime: '18:00' },
      ].sort((a, b) => a.dayOfWeek - b.dayOfWeek))
    }
  }

  const updateSlotTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    set('availability', data.availability.map((s) =>
      s.dayOfWeek === dayIndex ? { ...s, [field]: value } : s,
    ))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Auto-save status pill */}
      <SaveStatusPill status={status} lastSavedAt={lastSavedAt} errorMessage={errorMessage} />

      {/* ── Profile ── */}
      <Section title="Profile" description="Shown on your public booking page">
        <Field label="Display name" id="displayName">
          <input id="displayName" type="text" value={data.displayName} onChange={(e) => set('displayName', e.target.value)} className={inputCls} placeholder="Your name" />
        </Field>
        <Field label="Bio" id="bio">
          <textarea id="bio" rows={3} value={data.bio} onChange={(e) => set('bio', e.target.value)} className={`${inputCls} resize-none`} placeholder="Tell clients about your work…" maxLength={500} />
          <p className="text-xs text-white/30 mt-1">{data.bio.length}/500</p>
        </Field>
        <Field label="Style tags">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Style tags">
            {STYLE_TAG_OPTIONS.map((tag) => {
              const active = data.styleTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStyleTag(tag)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                    active ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/50 hover:text-white',
                  ].join(' ')}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Instagram handle" id="instagram">
          <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/50 bg-white/5">
            <span className="pl-4 pr-1 text-white/40 text-sm">@</span>
            <input id="instagram" type="text" value={data.instagramHandle} onChange={(e) => set('instagramHandle', e.target.value)} className="flex-1 bg-transparent py-2.5 pr-4 text-white placeholder-white/25 text-sm focus:outline-none" placeholder="yourhandle" />
          </div>
        </Field>
      </Section>

      {/* ── Colour palette ── */}
      <Section title="Colour palette" description="Colours used across your public page. Changes auto-save.">
        {COLOR_FIELDS.map(({ key, label, hint }) => {
          const value = data.colorScheme[key] || FALLBACK_COLORS[key]
          const valid = HEX_RE.test(value)
          const swatch = valid ? value : FALLBACK_COLORS[key]
          return (
            <div key={key} className="flex items-center gap-3">
              <label
                className="relative h-10 w-12 shrink-0 rounded-md border border-white/20 cursor-pointer overflow-hidden ring-1 ring-inset ring-white/10"
                style={{ backgroundColor: swatch }}
                aria-label={`${label} colour picker`}
              >
                <input
                  type="color"
                  value={swatch}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="absolute -inset-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)] cursor-pointer opacity-0"
                />
              </label>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 font-medium">{label}</p>
                <p className="text-white/35 text-xs">{hint}</p>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => updateColor(key, e.target.value)}
                aria-label={`${label} hex value`}
                className={`${inputCls} max-w-[7.5rem] font-mono uppercase ${valid ? '' : 'border-red-500/50'}`}
                placeholder="#000000"
                maxLength={7}
              />
            </div>
          )
        })}
      </Section>

      {/* ── Background image ── */}
      <Section
        title="Background image"
        description="Upload your own hero background. Sits behind your profile with a dark overlay so text stays readable. Optional — leave empty to use your palette."
      >
        {data.backgroundImageUrl ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.backgroundImageUrl}
                alt="Your page background"
                className="h-40 w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                disabled={bgUploading}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {bgUploading ? 'Uploading…' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={() => set('backgroundImageUrl', '')}
                disabled={bgUploading}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => bgInputRef.current?.click()}
            disabled={bgUploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center transition-colors hover:border-white/40 hover:bg-white/[0.04] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6 text-white/50" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="text-sm font-medium text-white">
              {bgUploading ? 'Uploading…' : 'Upload a background image'}
            </span>
            <span className="text-xs text-white/40">JPEG, PNG or WebP — up to 10MB</span>
          </button>
        )}

        <input
          ref={bgInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleBackgroundFile(e.target.files?.[0])}
        />
        {bgError && <p className="text-sm text-red-400">{bgError}</p>}
      </Section>

      {/* ── Studio ── */}
      <Section title="Studio" description="Studio details shown on your booking page">
        <Field label="Studio name" id="studioName">
          <input id="studioName" type="text" value={data.studioName} onChange={(e) => set('studioName', e.target.value)} className={inputCls} placeholder="Studio name (optional)" />
        </Field>
        <Field label="Studio address" id="studioAddress">
          <StudioLocationPicker
            address={data.studioAddress}
            onAddressChange={(address) => set('studioAddress', address)}
            onCoordsChange={(lat, lng) => {
              setData((prev) => ({ ...prev, studioLat: lat, studioLng: lng }))
            }}
          />
          <p className="text-xs text-white/30 mt-1">
            Search and select your studio to show a map on your public page.
          </p>
        </Field>
      </Section>

      {/* ── Pricing ── */}
      <Section title="Pricing">
        <Field label="Hourly rate" id="hourlyRate">
          <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/50 bg-white/5">
            <span className="pl-4 pr-2 text-white/40 text-sm">£</span>
            <input id="hourlyRate" type="number" min={0} step={0.01} value={data.hourlyRate ?? ''} onChange={(e) => set('hourlyRate', e.target.value ? parseFloat(e.target.value) : null)} className="flex-1 bg-transparent py-2.5 pr-4 text-white text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
          </div>
        </Field>
        <Field label="Price tier" id="priceTier">
          <select
            id="priceTier"
            value={data.priceTier || '££'}
            onChange={(e) => set('priceTier', e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/50 transition-colors"
          >
            <option value="£" className="bg-zinc-950 text-white">£ (Budget-friendly / Apprentice)</option>
            <option value="££" className="bg-zinc-950 text-white">££ (Standard / Mid-range)</option>
            <option value="£££" className="bg-zinc-950 text-white">£££ (Premium / High-end)</option>
          </select>
          <p className="text-xs text-white/30 mt-1">
            Price tiers help clients quickly search and filter artists by budget.
          </p>
        </Field>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Require a deposit</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data.depositRequired}
            onClick={() => set('depositRequired', !data.depositRequired)}
            className={['relative w-11 h-6 rounded-full transition-colors duration-200', data.depositRequired ? 'bg-white' : 'bg-white/20'].join(' ')}
          >
            <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200', data.depositRequired ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/60'].join(' ')} />
            <span className="sr-only">{data.depositRequired ? 'Deposit required' : 'No deposit'}</span>
          </button>
        </div>
        {data.depositRequired && (
          <Field label="Deposit amount" id="depositAmount">
            <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/50 bg-white/5">
              <span className="pl-4 pr-2 text-white/40 text-sm">£</span>
              <input id="depositAmount" type="number" min={0} step={0.01} value={data.depositAmount ?? ''} onChange={(e) => set('depositAmount', e.target.value ? parseFloat(e.target.value) : null)} className="flex-1 bg-transparent py-2.5 pr-4 text-white text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
            </div>
          </Field>
        )}
        <Field label="Pricing notes" id="pricingNotes">
          <textarea
            id="pricingNotes"
            rows={3}
            value={data.pricingNotes}
            onChange={(e) => set('pricingNotes', e.target.value)}
            className={`${inputCls} resize-none`}
            placeholder="e.g. Minimum charge £80, half sleeves from £600"
            maxLength={1000}
          />
          <p className="text-xs text-white/30 mt-1">{data.pricingNotes.length}/1000 — shown on your public page below your services</p>
        </Field>
      </Section>

      {/* ── Availability ── */}
      <Section title="Availability" description="Days and times you accept bookings">
        <div className="space-y-2" role="group" aria-label="Weekly availability">
          {DAY_LABELS.map((label, dayIndex) => {
            const slot = data.availability.find((s) => s.dayOfWeek === dayIndex)
            const active = !!slot
            return (
              <div key={dayIndex} className={['rounded-lg border overflow-hidden transition-all duration-150', active ? 'border-white/30 bg-white/5' : 'border-white/10'].join(' ')}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    aria-label={`${label} available`}
                    onClick={() => toggleDay(dayIndex)}
                    className={['w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-150', active ? 'bg-white border-white' : 'border-white/30 hover:border-white/60'].join(' ')}
                  >
                    {active && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="black" className="w-3.5 h-3.5" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <span className={['w-12 text-sm font-medium', active ? 'text-white' : 'text-white/40'].join(' ')}>{label}</span>
                  {active && slot && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input type="time" value={slot.startTime} onChange={(e) => updateSlotTime(dayIndex, 'startTime', e.target.value)} aria-label={`${label} start`} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none [color-scheme:dark]" />
                      <span className="text-white/40 text-xs">to</span>
                      <input type="time" value={slot.endTime} onChange={(e) => updateSlotTime(dayIndex, 'endTime', e.target.value)} aria-label={`${label} end`} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none [color-scheme:dark]" />
                    </div>
                  )}
                  {!active && <span className="ml-auto text-white/20 text-xs">Unavailable</span>}
                </div>
              </div>
            )
          })}
        </div>
        <Field label="Timezone" id="timezone">
          <input id="timezone" type="text" value={data.timezone} onChange={(e) => set('timezone', e.target.value)} className={inputCls} placeholder="Europe/London" />
        </Field>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-save status pill
// ---------------------------------------------------------------------------

function SaveStatusPill({
  status,
  lastSavedAt,
  errorMessage,
}: {
  status: SaveStatus
  lastSavedAt: Date | null
  errorMessage: string | null
}) {
  // Fixed to the viewport so it follows the user as they scroll and is never
  // clipped by an ancestor's overflow/transform. Sits bottom-right, above the
  // mobile bottom nav; sonner toasts live top-right so there's no collision.
  const wrapperCls =
    'fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium shadow-lg backdrop-blur-md transition-all duration-200'

  if (status === 'saving') {
    return (
      <div className={`${wrapperCls} bg-ink-900/90 border border-white/20 text-white/80`} aria-live="polite">
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="50 14" />
        </svg>
        Saving…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`${wrapperCls} bg-red-950/90 border border-red-500/40 text-red-300`} role="alert">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="max-w-[14rem] truncate">{errorMessage ?? 'Save failed'}</span>
      </div>
    )
  }

  if (status === 'saved' || lastSavedAt) {
    return (
      <div className={`${wrapperCls} bg-emerald-950/90 border border-emerald-500/40 text-emerald-300`} aria-live="polite">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
        Auto-saved
        {lastSavedAt && (
          <span className="text-emerald-300/60">
            · {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    )
  }

  return null
}
