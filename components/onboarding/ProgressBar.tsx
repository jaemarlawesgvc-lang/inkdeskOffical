'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

/**
 * Compact horizontal stepper used at the top of the onboarding flow on
 * smaller screens (the desktop layout uses the vertical rail in the wizard).
 *
 * Premium treatment: a thin ink track with a gold fill that advances with the
 * step, gold-filled completed nodes with a tick, and a gold-ringed current node.
 */
export function ProgressBar({ currentStep, totalSteps, labels }: ProgressBarProps) {
  const fillPct = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full" role="navigation" aria-label="Onboarding progress">
      <div className="relative">
        {/* Track */}
        <div className="absolute left-0 right-0 top-4 h-px bg-ink-800" aria-hidden="true" />
        {/* Gold fill */}
        <div
          className="absolute left-0 top-4 h-px bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500 ease-out"
          style={{ width: `${fillPct}%` }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        />

        {/* Nodes */}
        <ol className="relative flex justify-between">
          {labels.map((label, index) => {
            const step = index + 1
            const completed = step < currentStep
            const current = step === currentStep

            return (
              <li key={label} className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                    completed && 'bg-gold-500 text-ink-950 shadow-gold',
                    current &&
                      'bg-ink-900 text-gold-400 ring-2 ring-gold-500 ring-offset-2 ring-offset-ink-950',
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
                <span
                  className={cn(
                    'hidden text-[0.7rem] font-medium tracking-wide sm:block',
                    current ? 'text-parchment-200' : 'text-ink-500',
                  )}
                >
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
