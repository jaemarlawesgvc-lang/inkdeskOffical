'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { STYLE_TAG_OPTIONS } from '@/lib/validations/onboarding'
import { StudioLocationPicker } from '@/components/dashboard/StudioLocationPicker'

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
}

interface MyPageSettingsFormProps {
  artistId: string
  initialData: MyPageData
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DEBOUNCE_MS = 1500

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

    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, ...latestData.current }),
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
  if (status === 'saving') {
    return (
      <div className="sticky top-2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium" aria-live="polite">
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="50 14" />
        </svg>
        Saving…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="sticky top-2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium" role="alert">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errorMessage ?? 'Save failed'}
      </div>
    )
  }

  if (status === 'saved' || lastSavedAt) {
    return (
      <div className="sticky top-2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium" aria-live="polite">
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
