'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'
import { STYLE_TAG_OPTIONS } from '@/lib/validations/onboarding'
import { StudioLocationPicker } from '@/components/dashboard/StudioLocationPicker'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface SettingsData {
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
  emailBookingConfirmation: boolean
  emailReminders: boolean
  emailAftercare: boolean
}

interface SettingsFormProps {
  artistId: string
  plan: Plan
  initialData: SettingsData
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5">
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsForm({ artistId, plan, initialData }: SettingsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<SettingsData>(initialData)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const set = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
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

  const handleSave = async () => {
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, ...data }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSaveStatus('saved')
      startTransition(() => router.refresh())
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) window.location.href = json.url
      else setSaveError(json.error ?? 'Could not open billing portal')
    } catch {
      setSaveError('Could not open billing portal')
    } finally {
      setBillingLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    try {
      const res = await fetch('/api/dashboard/delete-account', { method: 'POST' })
      if (res.ok) window.location.href = '/login?deleted=true'
      else {
        const json = (await res.json()) as { error?: string }
        setSaveError(json.error ?? 'Could not delete account')
      }
    } catch {
      setSaveError('Could not delete account')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Error banner */}
      {saveError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {saveError}
        </div>
      )}

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
              set('studioLat', lat)
              set('studioLng', lng)
            }}
          />
          <p className="text-xs text-white/30 mt-1">
            Search and select your studio to show a map on your public page.
          </p>
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

      {/* ── Billing ── */}
      <Section id="billing" title="Billing" description="Manage your subscription and payment details">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Current plan</p>
            <p className="text-white/40 text-xs mt-0.5">{PLAN_DISPLAY[plan].description}</p>
          </div>
          <span className={[
            'px-3 py-1 rounded-full text-sm font-semibold',
            plan === 'free'
              ? 'bg-white/10 text-white/60'
              : plan === 'pro'
                ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
                : 'bg-violet-500/20 text-violet-400',
          ].join(' ')}>
            {PLAN_DISPLAY[plan].name} — {PLAN_DISPLAY[plan].price}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {plan === 'free' ? (
            <>
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="px-4 py-2.5 bg-gold-500 text-ink-950 text-sm font-semibold rounded-lg shadow-gold hover:bg-gold-400 active:bg-gold-600 transition-colors"
              >
                Start {SUBSCRIPTION_TRIAL_DAYS}-day free trial
              </button>
              <Link href="/dashboard/settings/billing" className="text-sm text-white/50 hover:text-white transition-colors">
                View billing details →
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleBillingPortal()}
                disabled={billingLoading}
                className="px-4 py-2.5 bg-white/10 text-white text-sm font-semibold rounded-lg hover:bg-white/20 disabled:opacity-40 transition-colors"
              >
                {billingLoading ? 'Opening…' : 'Manage billing'}
              </button>
              <Link href="/dashboard/settings/billing" className="text-sm text-white/50 hover:text-white transition-colors">
                Billing details →
              </Link>
            </>
          )}
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications" description="Control which emails you receive">
        {([
          { key: 'emailBookingConfirmation', label: 'Booking confirmations' },
          { key: 'emailReminders', label: '48-hour reminders' },
          { key: 'emailAftercare', label: 'Aftercare emails' },
        ] as const).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <p className="text-sm text-white/80">{label}</p>
            <button
              type="button"
              role="switch"
              aria-checked={data[key]}
              onClick={() => set(key, !data[key])}
              className={['relative w-11 h-6 rounded-full transition-colors duration-200', data[key] ? 'bg-white' : 'bg-white/20'].join(' ')}
            >
              <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200', data[key] ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/60'].join(' ')} />
              <span className="sr-only">{data[key] ? 'On' : 'Off'}</span>
            </button>
          </div>
        ))}
      </Section>

      {/* ── Save button ── */}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isPending || saveStatus === 'saving'}
        className={[
          'w-full py-3 rounded-lg font-semibold text-sm transition-all duration-150',
          saveStatus === 'saving' || isPending ? 'bg-white/20 text-white/40 cursor-not-allowed' : 'bg-white text-black hover:bg-white/90 active:scale-[0.98]',
        ].join(' ')}
      >
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save changes'}
      </button>

      {/* ── Danger zone ── */}
      <Section title="Danger zone">
        <div className="space-y-4">
          <div>
            <p className="text-white text-sm font-medium mb-1">Delete account</p>
            <p className="text-white/40 text-xs leading-relaxed">
              All your data will be soft-deleted immediately. Your subscription will be cancelled.
              Storage objects will be queued for deletion. This cannot be undone.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="deleteConfirm" className="text-xs text-white/50">
              Type <strong className="text-white">DELETE</strong> to confirm
            </label>
            <input
              id="deleteConfirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-white/5 border border-red-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/60 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={deleteConfirmText !== 'DELETE'}
            className={[
              'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
              deleteConfirmText === 'DELETE'
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-red-500/10 text-red-500/40 cursor-not-allowed',
            ].join(' ')}
          >
            Delete account permanently
          </button>
        </div>
      </Section>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}
