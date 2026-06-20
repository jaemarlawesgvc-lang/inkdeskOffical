'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/onboarding/ProgressBar'
import { Step1Username } from '@/components/onboarding/Step1Username'
import { Step2Profile } from '@/components/onboarding/Step2Profile'
import { Step3Portfolio } from '@/components/onboarding/Step3Portfolio'
import { Step4Pricing } from '@/components/onboarding/Step4Pricing'
import { Step5GenerateSite } from '@/components/onboarding/Step5GenerateSite'
import type {
  Step1Values,
  Step2Values,
  Step3Values,
  Step4Values,
  PortfolioImageMeta,
} from '@/lib/validations/onboarding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArtistData {
  id: string
  username: string | null
  displayName: string | null
  bio: string | null
  styleTags: string[] | null
  instagramHandle: string | null
  hourlyRate: number | null
  depositAmount: number | null
  depositRequired: boolean
  timezone: string | null
  onboardingStep: number
  portfolioImages: PortfolioImageMeta[]
  availabilitySlots: { dayOfWeek: number; startTime: string; endTime: string }[]
}

interface OnboardingWizardProps {
  artist: ArtistData
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_META = [
  { label: 'Username', blurb: 'Claim your address' },
  { label: 'Profile', blurb: 'Introduce your craft' },
  { label: 'Portfolio', blurb: 'Show your best work' },
  { label: 'Pricing', blurb: 'Rates & availability' },
  { label: 'Go Live', blurb: 'Generate your site' },
] as const

const STEP_LABELS = STEP_META.map((s) => s.label)
const TOTAL_STEPS = STEP_META.length

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function saveStep(step: number, data: unknown): Promise<void> {
  const res = await fetch('/api/onboarding/save-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, data }),
  })

  if (!res.ok) {
    const json = (await res.json()) as { error?: string }
    throw new Error(json.error ?? `Save failed for step ${step}`)
  }
}

// ---------------------------------------------------------------------------
// Wordmark
// ---------------------------------------------------------------------------

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-parchment-100">
      <span className="h-1.5 w-1.5 rounded-full bg-gold-500 shadow-gold" aria-hidden="true" />
      Inkquire
    </span>
  )
}

// ---------------------------------------------------------------------------
// Vertical step rail (desktop)
// ---------------------------------------------------------------------------

function StepRail({ currentStep }: { currentStep: number }) {
  return (
    <ol className="space-y-1">
      {STEP_META.map((meta, index) => {
        const step = index + 1
        const completed = step < currentStep
        const current = step === currentStep

        return (
          <li key={meta.label}>
            <div
              className={cn(
                'group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors duration-200',
                current && 'bg-ink-900/60 ring-1 ring-gold-500/20',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                  completed && 'bg-gold-500 text-ink-950 shadow-gold',
                  current && 'bg-ink-950 text-gold-400 ring-2 ring-gold-500',
                  !completed && !current && 'bg-ink-900 text-ink-500 ring-1 ring-ink-700',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {completed ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-semibold transition-colors',
                    current ? 'text-parchment-100' : completed ? 'text-parchment-300' : 'text-ink-500',
                  )}
                >
                  {meta.label}
                </p>
                <p className="truncate text-xs text-ink-600">{meta.blurb}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizard({ artist }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<number>(
    Math.min(Math.max(artist.onboardingStep, 1), TOTAL_STEPS),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const goBack = () => setCurrentStep((s) => Math.max(1, s - 1))

  const withSave = async <T,>(step: number, data: T, handler: (d: T) => unknown) => {
    setSaveError(null)
    setIsSaving(true)
    try {
      await saveStep(step, handler(data))
      setCurrentStep(step + 1)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStep1 = async (data: Step1Values) => {
    await withSave(1, data, (d) => d)
  }

  const handleStep2 = async (data: Step2Values) => {
    await withSave(2, data, (d) => d)
  }

  const handleStep3 = async (images: PortfolioImageMeta[]) => {
    const data: Step3Values = { images }
    await withSave(3, data, (d) => d)
  }

  const handleStep4 = async (data: Step4Values) => {
    await withSave(4, data, (d) => d)
  }

  const handleComplete = () => {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-parchment-100">
      {/* Ambient layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-gold-500/[0.07] blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* ── Editorial left rail (desktop) ── */}
        <aside className="hidden w-[42%] flex-col justify-between border-r border-ink-800/70 px-10 py-12 lg:flex">
          <Wordmark />

          <div className="max-w-sm">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-gold-500">
              Studio setup
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-[1.05] text-parchment-100">
              Set the stage
              <br />
              for your work.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-400">
              A few minutes now and Inkquire builds your portfolio site, opens your
              books, and gets you ready to take deposits — no design work required.
            </p>

            <div className="mt-10">
              <StepRail currentStep={currentStep} />
            </div>
          </div>

          <p className="text-xs text-ink-600">
            Your details are saved as you go. You can refine everything later from
            your dashboard.
          </p>
        </aside>

        {/* ── Form column ── */}
        <main className="flex flex-1 flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          {/* Mobile header */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Wordmark />
            <span className="text-sm text-ink-500">
              Step {currentStep} <span className="text-ink-700">/ {TOTAL_STEPS}</span>
            </span>
          </div>

          {/* Mobile horizontal progress */}
          <div className="mb-10 lg:hidden">
            <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />
          </div>

          {/* Desktop step counter */}
          <div className="mb-8 hidden items-center justify-end gap-2 text-xs font-medium uppercase tracking-widest text-ink-500 lg:flex">
            <span className="text-gold-500">Step {currentStep}</span>
            <span className="text-ink-700">of {TOTAL_STEPS}</span>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-xl">
              {/* Persistent save error banner */}
              {saveError && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-2.5 rounded-lg border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {saveError}
                </div>
              )}

              {/* Active step — re-keyed so each step fades up on mount */}
              <div key={currentStep} className="motion-safe:animate-fade-up">
                {currentStep === 1 && (
                  <Step1Username
                    defaultValues={{ username: artist.username ?? '' }}
                    onNext={handleStep1}
                    isSaving={isSaving}
                  />
                )}

                {currentStep === 2 && (
                  <Step2Profile
                    defaultValues={{
                      displayName: artist.displayName ?? '',
                      bio: artist.bio ?? '',
                      styleTags: (artist.styleTags ?? []) as Step2Values['styleTags'],
                      instagramHandle: artist.instagramHandle ?? '',
                    }}
                    onNext={handleStep2}
                    onBack={goBack}
                    isSaving={isSaving}
                  />
                )}

                {currentStep === 3 && (
                  <Step3Portfolio
                    artistId={artist.id}
                    defaultImages={artist.portfolioImages}
                    onNext={handleStep3}
                    onBack={goBack}
                    isSaving={isSaving}
                  />
                )}

                {currentStep === 4 && (
                  <Step4Pricing
                    defaultValues={{
                      hourlyRate: artist.hourlyRate ?? undefined,
                      depositAmount: artist.depositAmount ?? undefined,
                      depositRequired: artist.depositRequired,
                      timezone: artist.timezone ?? undefined,
                      availability: artist.availabilitySlots,
                    }}
                    onNext={handleStep4}
                    onBack={goBack}
                    isSaving={isSaving}
                  />
                )}

                {currentStep === 5 && (
                  <Step5GenerateSite onComplete={handleComplete} onBack={goBack} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
