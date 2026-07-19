'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { BookingCalendar } from '@/components/public/BookingCalendar'
import { ConsultationTimeSlots } from '@/components/public/ConsultationTimeSlots'
import { DepositPayment } from '@/components/public/DepositPayment'
import {
  CONSULTATION_DURATION_HOURS,
  CONSULTATION_DURATION_LABEL,
} from '@/lib/constants'

interface BookingSectionProps {
  artistId: string
  depositRequired: boolean
  depositAmount: number | null
  accentColor: string
  flashDesigns?: {
    id: string
    title: string
    price: number
    size_cm: string | null
    image_path: string
    status: 'available' | 'booked' | 'hidden'
  }[]
}

const formSchema = z.object({
  clientName: z.string().min(1, 'Name is required').max(200),
  clientEmail: z.string().email('Enter a valid email address'),
  clientPhone: z.string().max(30).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a date'),
  bookingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Select a consultation time'),
  description: z.string().max(2000).optional(),
})

type Stage = 'form' | 'payment' | 'success' | 'error'

const MAX_REFERENCES = 5
const SESSION_KEY = () => `inkdesk_session_${Math.random().toString(36).slice(2)}${Date.now()}`

interface ReferenceUpload {
  id: string
  name: string
  status: 'uploading' | 'done' | 'error'
  storagePath: string | null
}

const CONSULTATION_STEPS = [
  {
    step: '1',
    title: 'Book a consultation',
    body: `Pick a ${CONSULTATION_DURATION_LABEL} slot to meet and discuss your tattoo idea.`,
  },
  {
    step: '2',
    title: 'Design & quote',
    body: 'Talk through size, placement, style, and pricing. Share reference images if you have them.',
  },
  {
    step: '3',
    title: 'Schedule your session',
    body: 'Your actual tattoo appointment is booked separately — duration depends on the piece.',
  },
] as const

export function BookingSection({
  artistId,
  depositRequired,
  depositAmount,
  accentColor,
  flashDesigns = [],
}: BookingSectionProps) {
  const searchParams = useSearchParams()
  const flashParam = searchParams.get('flash')
  const [selectedFlashId, setSelectedFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (flashParam) {
      setSelectedFlashId(flashParam)
    }
  }, [flashParam])

  const selectedFlash = flashDesigns.find((d) => d.id === selectedFlashId && d.status === 'available') ?? null

  const [stage, setStage] = useState<Stage>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [bookingDate, setBookingDate] = useState<string | null>(null)
  const [bookingTime, setBookingTime] = useState('')
  const [description, setDescription] = useState('')
  const [references, setReferences] = useState<ReferenceUpload[]>([])

  const [holdId, setHoldId] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(SESSION_KEY())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleReferenceUpload = useCallback(
    async (files: FileList | null, activeHoldId: string) => {
      if (!files) return
      const slots = MAX_REFERENCES - references.length
      const toUpload = Array.from(files).slice(0, slots)

      for (const file of toUpload) {
        const id = Math.random().toString(36).slice(2)
        setReferences((prev) => [
          ...prev,
          { id, name: file.name, status: 'uploading', storagePath: null },
        ])

        const fd = new FormData()
        fd.append('file', file)
        fd.append('holdId', activeHoldId)

        try {
          const res = await fetch('/api/booking/upload-reference', { method: 'POST', body: fd })
          const json = (await res.json()) as { storagePath?: string; error?: string }
          if (!res.ok || !json.storagePath) throw new Error(json.error ?? 'Upload failed')
          setReferences((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, status: 'done', storagePath: json.storagePath ?? null } : r,
            ),
          )
        } catch {
          setReferences((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'error' } : r)),
          )
        }
      }
    },
    [references.length],
  )

  const ensureHold = useCallback(async (): Promise<string | null> => {
    if (holdId) return holdId
    if (!bookingDate || !bookingTime) return null

    try {
      const res = await fetch('/api/booking/create-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          date: bookingDate,
          time: bookingTime,
          sessionId: sessionIdRef.current,
        }),
      })
      const json = (await res.json()) as { holdId?: string; error?: string }
      if (!res.ok || !json.holdId) {
        setErrorMessage(json.error ?? 'This slot is no longer available.')
        return null
      }
      setHoldId(json.holdId)
      return json.holdId
    } catch {
      setErrorMessage('Could not reserve this slot. Please try again.')
      return null
    }
  }, [holdId, bookingDate, bookingTime, artistId])

  const onReferenceButton = async () => {
    const id = await ensureHold()
    if (id) fileInputRef.current?.click()
  }

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    setFieldErrors({})

    const parsed = formSchema.safeParse({
      clientName,
      clientEmail,
      clientPhone: clientPhone || undefined,
      bookingDate: bookingDate ?? '',
      bookingTime,
      description: description || undefined,
    })

    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.errors) {
        const key = issue.path[0]
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    setSubmitting(true)

    const activeHoldId = await ensureHold()
    if (!activeHoldId) {
      setSubmitting(false)
      return
    }

    const referencePaths = references
      .filter((r) => r.status === 'done' && r.storagePath)
      .map((r) => r.storagePath as string)

    try {
      const res = await fetch('/api/booking/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          holdId: activeHoldId,
          sessionId: sessionIdRef.current,
          clientName: parsed.data.clientName,
          clientEmail: parsed.data.clientEmail,
          clientPhone: parsed.data.clientPhone ?? '',
          bookingDate: parsed.data.bookingDate,
          bookingTime: parsed.data.bookingTime,
          durationHours: CONSULTATION_DURATION_HOURS,
          description: parsed.data.description ?? '',
          referenceImagePaths: referencePaths,
          flashDesignId: selectedFlashId || null,
        }),
      })

      const json = (await res.json()) as {
        bookingId?: string
        accessToken?: string
        requiresDeposit?: boolean
        depositAmount?: number | null
        error?: string
      }

      if (!res.ok || !json.bookingId) {
        setErrorMessage(json.error ?? 'Could not complete your booking.')
        setStage('error')
        setSubmitting(false)
        return
      }

      setBookingId(json.bookingId)
      setAccessToken(json.accessToken ?? null)

      if (json.requiresDeposit && json.accessToken) {
        const depRes = await fetch('/api/stripe/create-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: json.bookingId,
            artistId,
            clientEmail: parsed.data.clientEmail,
            accessToken: json.accessToken,
          }),
        })
        const depJson = (await depRes.json()) as { clientSecret?: string; error?: string }

        if (!depRes.ok || !depJson.clientSecret) {
          setErrorMessage(depJson.error ?? 'Could not set up the deposit payment.')
          setStage('error')
          setSubmitting(false)
          return
        }

        setClientSecret(depJson.clientSecret)
        setStage('payment')
        setSubmitting(false)
        return
      }

      setStage('success')
      setSubmitting(false)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setStage('error')
      setSubmitting(false)
    }
  }

  const handlePaymentSuccess = () => setStage('success')
  const handlePaymentError = (msg: string) => {
    setErrorMessage(msg)
    setStage('error')
  }

  const resetFlow = () => {
    setStage('form')
    setErrorMessage(null)
    setHoldId(null)
    setClientSecret(null)
    sessionIdRef.current = SESSION_KEY()
  }

  const handleDateSelect = (d: string) => {
    setBookingDate(d)
    setBookingTime('')
    setHoldId(null)
  }

  const handleTimeSelect = (t: string) => {
    setBookingTime(t)
    setHoldId(null)
  }

  const inputCls =
    'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/25 text-base sm:text-sm focus:outline-none focus:border-white/50 transition-colors min-h-[48px]'

  const sectionPad = 'px-4 sm:px-6 py-12 sm:py-20 pb-28 lg:pb-20'

  if (stage === 'success') {
    return (
      <section id="book" className={sectionPad} aria-label="Booking confirmation">
        <div className="max-w-md mx-auto text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={accentColor} className="w-8 h-8" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold" style={{ color: '#f5f5f0' }}>
            {depositRequired ? 'Consultation confirmed' : 'Consultation request received'}
          </h2>
          <p className="text-white/55 text-base leading-relaxed">
            {depositRequired
              ? `Your ${CONSULTATION_DURATION_LABEL} consultation is confirmed. A confirmation email is on its way. Your tattoo session will be scheduled after you meet.`
              : `Your consultation request has been sent to the artist. You'll receive an email once it's confirmed. Remember — this is a ${CONSULTATION_DURATION_LABEL} consultation, not your tattoo session.`}
          </p>
          {accessToken && (
            <a
              href={`/api/booking/status?token=${accessToken}`}
              className="inline-block text-sm underline underline-offset-2 text-white/40 hover:text-white transition-colors"
            >
              View booking status
            </a>
          )}
        </div>
      </section>
    )
  }

  if (stage === 'error') {
    return (
      <section id="book" className={sectionPad} aria-label="Booking error">
        <div className="max-w-md mx-auto text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f87171" className="w-8 h-8" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold" style={{ color: '#f5f5f0' }}>
            Something went wrong
          </h2>
          <p className="text-white/55 text-base">{errorMessage ?? 'Please try again.'}</p>
          <button
            type="button"
            onClick={resetFlow}
            className="px-6 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-95 min-h-[48px]"
            style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (stage === 'payment' && clientSecret && depositAmount !== null) {
    return (
      <section id="book" className={sectionPad} aria-label="Deposit payment">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold" style={{ color: '#f5f5f0' }}>
              Secure your consultation
            </h2>
            <p className="text-white/55 text-sm mt-2">
              A £{depositAmount.toFixed(2)} deposit confirms your {CONSULTATION_DURATION_LABEL} consultation.
            </p>
          </div>
          <DepositPayment
            clientSecret={clientSecret}
            depositAmount={depositAmount}
            accentColor={accentColor}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            bookingId={bookingId ?? undefined}
            artistId={artistId}
            accessToken={accessToken}
          />
        </div>
      </section>
    )
  }

  return (
    <section id="book" className={`${sectionPad} bg-white/[0.02]`} aria-label="Book a consultation">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
            Appointments
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold mb-3" style={{ color: '#f5f5f0' }}>
            Book a consultation
          </h2>
          <p className="text-white/55 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            {depositRequired
              ? 'Reserve a consultation slot. A deposit secures your appointment.'
              : 'Choose a consultation time — the artist will confirm your booking.'}
          </p>
        </div>

        {/* How it works */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/80">How booking works</h3>
          <ol className="space-y-3">
            {CONSULTATION_STEPS.map((item) => (
              <li key={item.step} className="flex gap-3">
                <span
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
                >
                  {item.step}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium text-white/85">{item.title}</p>
                  <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div
            className="rounded-lg px-3 py-2.5 text-xs leading-relaxed border"
            style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}10`, color: '#f5f5f0' }}
          >
            <strong className="font-semibold">Consultation length:</strong> {CONSULTATION_DURATION_LABEL}.
            Your tattoo session may take 1–8+ hours depending on the piece — that gets scheduled after your consultation.
          </div>
        </div>

        {depositRequired && depositAmount !== null && (
          <p className="text-center text-base font-bold mb-6" style={{ color: accentColor }}>
            Consultation deposit: £{depositAmount.toFixed(2)}
          </p>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="space-y-5">
          {selectedFlash && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center motion-safe:animate-fade-in">
              <img
                src={selectedFlash.image_path}
                alt={selectedFlash.title}
                className="w-16 h-16 object-cover rounded-xl border border-white/10"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                  Selected Flash Design
                </p>
                <h4 className="text-white font-semibold text-sm mt-0.5">{selectedFlash.title}</h4>
                <p className="text-white/40 text-xs mt-0.5">
                  Price: £{Number(selectedFlash.price).toFixed(0)} {selectedFlash.size_cm ? `· ${selectedFlash.size_cm}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFlashId(null)
                  const params = new URLSearchParams(window.location.search)
                  params.delete('flash')
                  window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`)
                }}
                className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Remove flash design"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="bk-name" className="block text-sm font-medium text-white/70">
              Name <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input id="bk-name" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="Your name" autoComplete="name" aria-required="true" />
            {fieldErrors.clientName && <p className="text-red-400 text-sm" role="alert">{fieldErrors.clientName}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bk-email" className="block text-sm font-medium text-white/70">
              Email <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input id="bk-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputCls} placeholder="you@example.com" autoComplete="email" aria-required="true" />
            {fieldErrors.clientEmail && <p className="text-red-400 text-sm" role="alert">{fieldErrors.clientEmail}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bk-phone" className="block text-sm font-medium text-white/70">Phone</label>
            <input id="bk-phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputCls} placeholder="Optional" autoComplete="tel" />
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-white/70">
              Consultation date <span className="text-red-400" aria-hidden="true">*</span>
            </span>
            <div className="bg-white/5 border border-white/20 rounded-lg p-3 sm:p-4">
              <BookingCalendar
                artistId={artistId}
                selectedDate={bookingDate}
                onDateSelect={handleDateSelect}
                accentColor={accentColor}
              />
            </div>
            {fieldErrors.bookingDate && <p className="text-red-400 text-sm" role="alert">{fieldErrors.bookingDate}</p>}
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-white/70">
              Consultation time <span className="text-red-400" aria-hidden="true">*</span>
            </span>
            <div className="bg-white/5 border border-white/20 rounded-lg p-3 sm:p-4">
              <ConsultationTimeSlots
                artistId={artistId}
                selectedDate={bookingDate}
                selectedTime={bookingTime}
                onTimeSelect={handleTimeSelect}
                accentColor={accentColor}
              />
            </div>
            {fieldErrors.bookingTime && <p className="text-red-400 text-sm" role="alert">{fieldErrors.bookingTime}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bk-desc" className="block text-sm font-medium text-white/70">
              Tell us about your tattoo idea
            </label>
            <textarea id="bk-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none min-h-[120px]`} placeholder="Describe your idea, size, placement, style…" maxLength={2000} />
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-white/70">
              Reference images <span className="text-white/30">(up to {MAX_REFERENCES})</span>
            </span>
            <button
              type="button"
              onClick={() => void onReferenceButton()}
              disabled={references.length >= MAX_REFERENCES || !bookingDate || !bookingTime}
              title={!bookingDate || !bookingTime ? 'Select a date and time first' : undefined}
              className="w-full py-3 rounded-lg border border-dashed border-white/25 text-white/50 text-sm hover:border-white/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            >
              {references.length >= MAX_REFERENCES ? 'Maximum reached' : '+ Add reference images'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { if (holdId) void handleReferenceUpload(e.target.files, holdId); e.target.value = '' }}
              className="sr-only"
              aria-hidden="true"
            />
            {references.length > 0 && (
              <ul className="space-y-1.5" aria-label="Uploaded references">
                {references.map((r) => (
                  <li key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm min-h-[44px]">
                    <span className="text-white/60 truncate flex-1">{r.name}</span>
                    <span className="ml-3 flex items-center gap-2 shrink-0">
                      {r.status === 'uploading' && <span className="text-white/30 text-xs">Uploading…</span>}
                      {r.status === 'done' && <span className="text-emerald-400 text-xs">Ready</span>}
                      {r.status === 'error' && <span className="text-red-400 text-xs">Failed</span>}
                      <button type="button" onClick={() => removeReference(r.id)} aria-label={`Remove ${r.name}`} className="text-white/30 hover:text-white transition-colors p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full py-4 rounded-lg font-bold text-base sm:text-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black min-h-[52px]"
            style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
          >
            {submitting ? 'Processing…' : depositRequired ? 'Continue to deposit' : 'Request consultation'}
          </button>
        </div>
      </div>
    </section>
  )
}
