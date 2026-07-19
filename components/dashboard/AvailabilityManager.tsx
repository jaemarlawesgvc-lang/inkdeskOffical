'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DAYS_OF_WEEK } from '@/lib/constants'

interface Window {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface AvailabilityManagerProps {
  initialWindows: Window[]
  initialBufferMinutes: number
  feedUrl: string | null
}

const inputCls =
  'bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

export function AvailabilityManager({
  initialWindows,
  initialBufferMinutes,
  feedUrl,
}: AvailabilityManagerProps) {
  const router = useRouter()
  const [windows, setWindows] = useState<Window[]>(initialWindows)
  const [bufferMinutes, setBufferMinutes] = useState<number>(initialBufferMinutes)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const addWindow = (dayOfWeek: number) => {
    setWindows((prev) => [...prev, { dayOfWeek, startTime: '09:00', endTime: '17:00' }])
  }

  const removeWindow = (index: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateWindow = (index: number, patch: Partial<Window>) => {
    setWindows((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  }

  const handleSave = async () => {
    // Client-side validation: end after start.
    for (const w of windows) {
      if (w.endTime <= w.startTime) {
        toast.error('Each window must end after it starts')
        return
      }
    }
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windows, bufferMinutes }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not save availability')
      toast.success('Availability saved')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save availability')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      toast.success('Calendar URL copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Weekly windows ── */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Weekly hours</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Add one or more windows per day. Clients can only book inside these hours.
          </p>
        </div>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayWindows = windows
              .map((w, i) => ({ w, i }))
              .filter(({ w }) => w.dayOfWeek === day.value)

            return (
              <div key={day.value} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white/80 w-24">{day.label}</span>
                  <button
                    type="button"
                    onClick={() => addWindow(day.value)}
                    className="text-xs font-medium text-white/50 hover:text-white underline underline-offset-2"
                  >
                    + Add window
                  </button>
                </div>

                {dayWindows.length === 0 ? (
                  <p className="text-white/25 text-xs mt-2">Closed</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {dayWindows.map(({ w, i }) => (
                      <li key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={w.startTime}
                          onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                          className={inputCls}
                          aria-label={`${day.label} start time`}
                        />
                        <span className="text-white/30 text-sm">–</span>
                        <input
                          type="time"
                          value={w.endTime}
                          onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                          className={inputCls}
                          aria-label={`${day.label} end time`}
                        />
                        <button
                          type="button"
                          onClick={() => removeWindow(i)}
                          aria-label="Remove window"
                          className="ml-1 text-red-400/70 hover:text-red-400 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Buffer / setup time ── */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Setup / buffer time</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Minutes kept clear before and after every booking so you have time to prep and clean down.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={240}
            step={5}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
            className={`${inputCls} w-24`}
            aria-label="Buffer minutes"
          />
          <span className="text-white/50 text-sm">minutes</span>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
      >
        {busy ? 'Saving…' : 'Save availability'}
      </button>

      {/* ── iCal subscribe URL ── */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Sync to your calendar</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Subscribe to this private link in Google or Apple Calendar to see your confirmed
            bookings alongside your personal events (one-way, read-only).
          </p>
        </div>
        {feedUrl ? (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputCls} flex-1 font-mono text-xs`}
              aria-label="Calendar subscription URL"
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors flex-shrink-0"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="text-white/30 text-sm">
            Your calendar link will appear here once your profile is set up.
          </p>
        )}
        <p className="text-white/25 text-[11px] leading-relaxed">
          Keep this link private — anyone who has it can see your booking times.
        </p>
      </section>
    </div>
  )
}
