'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MEDICAL_QUESTIONS, type MedicalAnswers, type MedicalQuestionId } from '@/lib/consent/questions'

interface ArtistInfo {
  artistId: string
  artistName: string
  studioName: string | null
}

const inputCls =
  'w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/40 transition-colors'

export function ConsentFormView() {
  const searchParams = useSearchParams()
  const artistId = searchParams.get('artist_id')
  const bookingId = searchParams.get('booking_id')

  const [artist, setArtist] = useState<ArtistInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [clientName, setClientName] = useState('')
  const [clientDob, setClientDob] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [tattooDescription, setTattooDescription] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [medicalAnswers, setMedicalAnswers] = useState<Partial<MedicalAnswers>>({})
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [signatureName, setSignatureName] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!artistId) {
      setLoadError('This consent form link is missing required information.')
      setLoading(false)
      return
    }
    fetch(`/api/consent-form/info?artist_id=${artistId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Artist not found')
        const json = await res.json()
        setArtist(json)
      })
      .catch(() => setLoadError('We couldn’t find this artist’s consent form. Please ask them to resend the link.'))
      .finally(() => setLoading(false))
  }, [artistId])

  const answeredCount = Object.keys(medicalAnswers).length
  const sectionsComplete = [
    clientName.trim().length >= 2 && !!clientDob,
    tattooDescription.trim().length >= 5,
    ageConfirmed,
    answeredCount === MEDICAL_QUESTIONS.length,
    consentAgreed && signatureName.trim().length >= 2,
  ]
  const progress = useMemo(
    () => Math.round((sectionsComplete.filter(Boolean).length / sectionsComplete.length) * 100),
    [sectionsComplete],
  )

  const canSubmit = sectionsComplete.every(Boolean) && !submitting

  const setAnswer = (id: MedicalQuestionId, value: 'yes' | 'no') => {
    setMedicalAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async () => {
    if (!canSubmit || !artistId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/consent-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          bookingId: bookingId || null,
          clientName: clientName.trim(),
          clientDob,
          clientPhone: clientPhone.trim() || undefined,
          tattooDescription: tattooDescription.trim(),
          ageConfirmed,
          medicalAnswers,
          consentAgreed,
          signatureName: signatureName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit consent form')
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit consent form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError || !artist) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <p className="text-white/40 text-sm text-center max-w-sm">{loadError}</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="w-7 h-7">
              <path d="M5 10.5l3 3 7-7" stroke="#d4af37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Consent form sent</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Thanks, {clientName.split(' ')[0]}. Your signed consent form has been sent to{' '}
            <span className="text-white">{artist.artistName}</span>. You&rsquo;re all set for your appointment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-20">
        <div
          className="h-full bg-gradient-to-r from-[#d4af37] to-[#f4d976] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold">
            {artist.artistName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#d4af37] uppercase tracking-[2px]">Consent Form</p>
            <p className="text-sm font-semibold text-white">
              {artist.artistName}{artist.studioName ? ` · ${artist.studioName}` : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-8 space-y-8 pb-32">
        {/* Step 1 */}
        <Section step={1} title="Your details" done={sectionsComplete[0]}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Full name</label>
              <input className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Date of birth</label>
                <input type="date" className={inputCls} value={clientDob} onChange={(e) => setClientDob(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Phone (optional)</label>
                <input className={inputCls} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="07700 900000" />
              </div>
            </div>
          </div>
        </Section>

        {/* Step 2 */}
        <Section step={2} title="Tattoo description" done={sectionsComplete[1]}>
          <label className="text-xs text-white/40 mb-1.5 block">Design, placement, and size</label>
          <textarea
            className={`${inputCls} min-h-[90px] resize-none`}
            value={tattooDescription}
            onChange={(e) => setTattooDescription(e.target.value)}
            placeholder="e.g. Small floral piece on the left forearm, roughly 10cm"
          />
        </Section>

        {/* Step 3 */}
        <Section step={3} title="Age confirmation" done={sectionsComplete[2]}>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/30 bg-white/5 accent-[#d4af37]"
            />
            <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
              I confirm that I am 18 years of age or older.
            </span>
          </label>
        </Section>

        {/* Step 4 */}
        <Section step={4} title="Medical disclosure" done={sectionsComplete[3]}>
          <div className="space-y-3">
            {MEDICAL_QUESTIONS.map((q) => (
              <div key={q.id} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3.5">
                <p className="text-sm text-white/80 mb-2.5">{q.text}</p>
                <div className="flex gap-2">
                  {(['yes', 'no'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={[
                        'px-4 py-1.5 rounded-md text-xs font-semibold transition-colors border',
                        medicalAnswers[q.id] === opt
                          ? opt === 'yes'
                            ? 'bg-red-500/15 border-red-500/40 text-red-300'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-transparent border-white/15 text-white/40 hover:border-white/30',
                      ].join(' ')}
                    >
                      {opt === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Step 5 */}
        <Section step={5} title="Consent & signature" done={sectionsComplete[4]}>
          <div className="bg-white/[0.03] border border-white/[0.06] border-l-2 border-l-[#d4af37] rounded-lg p-4 mb-4">
            <p className="text-xs text-white/50 leading-relaxed">
              I understand that tattooing is a permanent procedure that carries inherent risks, including but not
              limited to infection, allergic reaction, and scarring. I have disclosed all relevant medical
              information above to the best of my knowledge. I consent to receive the tattoo described, release{' '}
              {artist.studioName ? `${artist.studioName} and ` : ''}{artist.artistName} from liability for risks
              inherent to the tattooing process when performed with reasonable care, and confirm I have received
              aftercare instructions.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group mb-4">
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/30 bg-white/5 accent-[#d4af37]"
            />
            <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
              I have read and agree to the consent statement above.
            </span>
          </label>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Type your full name as your signature</label>
            <input
              className={`${inputCls} font-medium italic`}
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
        </Section>

        {submitError && <p className="text-red-400 text-sm text-center">{submitError}</p>}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#d4af37] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-white/30 mt-1.5">{progress}% complete</p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {submitting ? 'Submitting…' : 'Sign & submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  step,
  title,
  done,
  children,
}: {
  step: number
  title: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className={[
            'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
            done ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white/50',
          ].join(' ')}
        >
          {done ? '✓' : step}
        </div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="pl-[34px]">{children}</div>
    </section>
  )
}
