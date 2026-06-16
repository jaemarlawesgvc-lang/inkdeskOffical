'use client'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export function ProgressBar({ currentStep, totalSteps, labels }: ProgressBarProps) {
  return (
    <div className="w-full" role="navigation" aria-label="Onboarding progress">
      {/* Step labels */}
      <div className="flex justify-between mb-2">
        {labels.map((label, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep

          return (
            <div
              key={label}
              className="flex flex-col items-center"
              style={{ width: `${100 / totalSteps}%` }}
            >
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200',
                  isCompleted
                    ? 'bg-white text-black'
                    : isCurrent
                      ? 'bg-white/20 text-white ring-2 ring-white'
                      : 'bg-white/10 text-white/40',
                ].join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={[
                  'mt-1 text-xs text-center hidden sm:block transition-colors duration-200',
                  isCurrent ? 'text-white font-medium' : 'text-white/40',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress track */}
      <div className="relative mt-1">
        <div className="h-1 bg-white/10 rounded-full" />
        <div
          className="absolute top-0 left-0 h-1 bg-white rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
          }}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        />
      </div>
    </div>
  )
}
