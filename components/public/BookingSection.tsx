'use client'

import { useState, useRef, useCallback } from 'react'
import { z } from 'zod'
import { BookingCalendar } from '@/components/public/BookingCalendar'
import { DepositPayment } from '@/components/public/DepositPayment'

interface BookingSectionProps {
  artistId: string
  depositRequired: boolean
  depositAmount: number | null
  accentColor: string
}

// Client-side form schema (mirrors server submitBookingSchema fields the form collects)
const formSchema = z.object({
  clientName: z.string().min(1, 'Name is required').max(200),
  clientEmail: z.string().email('Enter a valid email address'),
  clientPhone: z.string().max(30).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a date'),
  bookingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Select a time'),
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

export function BookingSection({
  artistId,
  depositRequired,
  depositAmount,
  accentColor,
}: BookingSectionProps) {
  const [stage, setStage] = useState<Stage>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [bookingDate, setBookingDate] = useState<string | null>(null)
  const [bookingTime, setBookingTime] = useState('')
  const [description, setDescription] = useState('')
  const [references, setReferences] = useState<ReferenceUpload[]>([])

  // Flow state
  const [holdId, setHoldId] = useState<string | null>(null)
  const [, setBookingId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(SESSION_KEY())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reference image upload ──
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

  // Ensure a hold exists before uploading references (references are keyed by holdId)
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

  // ── Submit ──
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

    // 1. Ensure hold
    const activeHoldId = await ensureHold()
    if (!activeHoldId) {
      setSubmitting(false)
      return
    }

    // 2. Submit booking
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
          description: parsed.data.description ?? '',
          referenceImagePaths: referencePaths,
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

      // 3. Deposit path vs manual confirmation path
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

      // No deposit required → manual confirmation path; booking is pending
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

  const inputCls =
    'w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors'

  // ── Success screen ──
  if (stage === 'success') {
    return (
      <section id="book" className="px-6 py-16 sm:py-24" aria-label="Booking confirmation">
        <div className="max-w-md mx-auto text-center space-y-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={accentColor} className="w-8 h-8" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-serif text-3xl font-bold" style={{ color: '#f5f5f0' }}>
            {depositRequired ? 'Booking confirmed' : 'Request received'}
          </h2>
          <p className="text-white/55 text-base leading-relaxed">
            {depositRequired
              ? 'Your deposit has been received and your booking is confirmed. A confirmation email is on its way.'
              : 'Your booking request has been sent to the artist for confirmation. You will receive an email once it is confirmed.'}
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

  // ── Error screen ──
  if (stage === 'error') {
    return (
      <section id="book" className="px-6 py-16 sm:py-24" aria-label="Booking error">
        <div className="max-w-md mx-auto text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f87171" className="w-8 h-8" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-serif text-3xl font-bold" style={{ color: '#f5f5f0' }}>
            Something went wrong
          </h2>
          <p className="text-white/55 text-base">{errorMessage ?? 'Please try again.'}</p>
          <button
            type="button"
            onClick={resetFlow}
            className="px-6 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  // ── Payment screen ──
  if (stage === 'payment' && clientSecret && depositAmount !== null) {
    return (
      <section id="book" className="px-6 py-16 sm:py-24" aria-label="Deposit payment">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold" style={{ color: '#f5f5f0' }}>
              Secure your booking
            </h2>
            <p className="text-white/55 text-sm mt-2">
              A £{depositAmount.toFixed(2)} deposit confirms your appointment.
            </p>
          </div>
          <DepositPayment
            clientSecret={clientSecret}
            depositAmount={depositAmount}
            accentColor={accentColor}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </section>
    )
  }

  // ── Form screen ──
  return (
    <section id="book" className="px-6 py-16 sm:py-24 bg-white/[0.02]" aria-label="Booking form">
      <div className="max-w-lg mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-2 text-center" style={{ color: '#f5f5f0' }}>
          Book a session
        </h2>
        <p className="text-white/50 text-sm text-center mb-2">
          {depositRequired
            ? 'A deposit is required to confirm your booking.'
            : 'Submit a request and the artist will confirm your appointment.'}
        </p>

        <p
          className={['text-center text-base font-bold', depositRequired && depositAmount !== null ? 'mb-8' : 'mb-6'].join(' ')}
          style={{ color: accentColor }}
        >
          {depositRequired && depositAmount !== null ? `Deposit due today: £${depositAmount.toFixed(2)}` : ' '}
        </p>

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="bk-name" className="block text-sm font-medium text-white/70">
              Name <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input id="bk-name" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="Your name" autoComplete="name" aria-required="true" />
            {fieldErrors.clientName && <p className="text-red-400 text-sm" role="alert">{fieldErrors.clientName}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="bk-email" className="block text-sm font-medium text-white/70">
              Email <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input id="bk-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputCls} placeholder="you@example.com" autoComplete="email" aria-required="true" />
            {fieldErrors.clientEmail && <p className="text-red-400 text-sm" role="alert">{fieldErrors.clientEmail}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="bk-phone" className="block text-sm font-medium text-white/70">Phone</label>
            <input id="bk-phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputCls} placeholder="Optional" autoComplete="tel" />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-white/70">
              Preferred date <span className="text-red-400" aria-hidden="true">*</span>
            </span>
            <div className="bg-white/5 border border-white/20 rounded-lg p-4">
              <BookingCalendar
                artistId={artistId}
                selectedDate={bookingDate}
                onDateSelect={(d) => { setBookingDate(d); setHoldId(null) }}
                accentColor={accentColor}
              />
            </div>
            {fieldErrors.bookingDate && <p className="text-red-400 text-sm" role="alert">{fieldErrors.bookingDate}</p>}
          </div>

          {/* Time */}
          <div className="space-y-1.5">
            <label htmlFor="bk-time" className="block text-sm font-medium text-white/70">
              Preferred time <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <input id="bk-time" type="time" value={bookingTime} onChange={(e) => { setBookingTime(e.target.value); setHoldId(null) }} className={`${inputCls} [color-scheme:dark]`} aria-required="true" />
            {fieldErrors.bookingTime && <p className="text-red-400 text-sm" role="alert">{fieldErrors.bookingTime}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="bk-desc" className="block text-sm font-medium text-white/70">Tattoo description</label>
            <textarea id="bk-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} placeholder="Describe your idea, size, placement…" maxLength={2000} />
          </div>

          {/* Reference images */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-white/70">
              Reference images <span className="text-white/30">(up to {MAX_REFERENCES})</span>
            </span>
            <button
              type="button"
              onClick={() => void onReferenceButton()}
              disabled={references.length >= MAX_REFERENCES || !bookingDate || !bookingTime}
              title={!bookingDate || !bookingTime ? 'Select a date and time first' : undefined}
              className="w-full py-3 rounded-lg border border-dashed border-white/25 text-white/50 text-sm hover:border-white/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <li key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <span className="text-white/60 truncate flex-1">{r.name}</span>
                    <span className="ml-3 flex items-center gap-2">
                      {r.status === 'uploading' && <span className="text-white/30 text-xs">Uploading…</span>}
                      {r.status === 'done' && <span className="text-emerald-400 text-xs">Ready</span>}
                      {r.status === 'error' && <span className="text-red-400 text-xs">Failed</span>}
                      <button type="button" onClick={() => removeReference(r.id)} aria-label={`Remove ${r.name}`} className="text-white/30 hover:text-white transition-colors">
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

          {/* Submit */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full py-4 rounded-lg font-bold text-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
          >
            {submitting ? 'Processing…' : depositRequired ? 'Continue to deposit' : 'Request booking'}
          </button>
        </div>
      </div>
    </section>
  )
}
