'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'
import { UpgradeModal } from '@/components/dashboard/UpgradeModal'
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/constants'

interface SettingsData {
  emailBookingConfirmation: boolean
  emailReminders: boolean
  emailAftercare: boolean
}

interface SettingsFormProps {
  artistId: string
  plan: Plan
  initialData: SettingsData
}

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

export function SettingsForm({ artistId, plan, initialData }: SettingsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<SettingsData>(initialData)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [billingLoading, setBillingLoading] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const set = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, ...data }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`)
      setSaveStatus('saved')
      toast.success('Profile saved successfully!')
      startTransition(() => router.refresh())
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      setSaveStatus('error')
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) window.location.href = json.url
      else toast.error(json.error ?? 'Could not open billing portal')
    } catch {
      toast.error('Could not open billing portal')
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
        toast.error(json.error ?? 'Could not delete account')
      }
    } catch {
      toast.error('Could not delete account')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
