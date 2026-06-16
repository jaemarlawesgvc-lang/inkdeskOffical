'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
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

const STEP_LABELS = ['Username', 'Profile', 'Portfolio', 'Pricing', 'Go Live']
const TOTAL_STEPS = 5

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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-white font-bold tracking-tight text-lg">InkDesk</span>
          <span className="text-white/40 text-sm">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-white/10 px-6 py-5">
        <div className="max-w-lg mx-auto">
          <ProgressBar
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          {/* Persistent save error banner */}
          {saveError && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm"
            >
              {saveError}
            </div>
          )}

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
      </main>
    </div>
  )
}
