'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { step4Schema, type Step4Values, type AvailabilitySlot } from '@/lib/validations/onboarding'
import {
  StepIntro,
  FieldLabel,
  FieldError,
  Hint,
  Toggle,
  WizardNav,
  selectClass,
  prefixWrapClass,
} from '@/components/onboarding/ui'

interface Step4Props {
  defaultValues: Partial<Step4Values>
  onNext: (data: Step4Values) => Promise<void>
  onBack: () => void
  isSaving: boolean
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_START = '09:00'
const DEFAULT_END = '18:00'

// Common timezones — enough for an MVP; the selector allows freeform Intl zones
const COMMON_TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Pacific/Auckland',
  'UTC',
]

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

const timeInputClass =
  'rounded-md border border-ink-700 bg-ink-950/60 px-2 py-1 text-xs text-parchment-100 focus:border-gold-500/50 focus:outline-none [color-scheme:dark]'

export function Step4Pricing({ defaultValues, onNext, onBack, isSaving }: Step4Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<Step4Values>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      hourlyRate: defaultValues.hourlyRate ?? undefined,
      depositAmount: defaultValues.depositAmount ?? undefined,
      // Deposits are optional. Only pre-tick the toggle when the artist has
      // actually set a deposit amount — a brand-new artist row defaults
      // deposit_required=true in the DB, which previously blocked this step
      // (toggle on + empty amount = invalid form). Now it starts off.
      depositRequired:
        defaultValues.depositAmount != null && (defaultValues.depositRequired ?? false),
      timezone: defaultValues.timezone ?? detectTimezone(),
      availability: defaultValues.availability ?? [],
    },
    mode: 'onTouched',
  })

  const depositRequired = watch('depositRequired')
  const availability = watch('availability')
  const busy = isSubmitting || isSaving

  const toggleDay = (dayIndex: number) => {
    const current: AvailabilitySlot[] = availability ?? []
    const exists = current.find((s) => s.dayOfWeek === dayIndex)

    if (exists) {
      setValue(
        'availability',
        current.filter((s) => s.dayOfWeek !== dayIndex),
        { shouldValidate: true },
      )
    } else {
      const next: AvailabilitySlot[] = [
        ...current,
        { dayOfWeek: dayIndex, startTime: DEFAULT_START, endTime: DEFAULT_END },
      ].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      setValue('availability', next, { shouldValidate: true })
    }
  }

  const updateSlotTime = (
    dayIndex: number,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    const current: AvailabilitySlot[] = availability ?? []
    setValue(
      'availability',
      current.map((s) => (s.dayOfWeek === dayIndex ? { ...s, [field]: value } : s)),
      { shouldValidate: true },
    )
  }

  const allTimezones = Array.from(
    new Set([...COMMON_TIMEZONES, detectTimezone()]),
  ).sort()

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-8">
      <StepIntro
        eyebrow="Step 4 · Pricing & availability"
        title="Set your terms"
        description="Tell clients what you charge and when you take appointments. Everything here is editable later."
      />

      {/* Hourly rate */}
      <div className="space-y-2">
        <FieldLabel htmlFor="hourlyRate">Hourly rate</FieldLabel>
        <div className={prefixWrapClass}>
          <span className="select-none border-r border-ink-700 bg-ink-950/40 py-3 px-4 text-sm text-ink-400">£</span>
          <input
            id="hourlyRate"
            type="number"
            min={0}
            max={9999}
            step={0.01}
            placeholder="0.00"
            className="flex-1 bg-transparent py-3 px-3 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-describedby={errors.hourlyRate ? 'hourlyRate-error' : undefined}
            {...register('hourlyRate', { valueAsNumber: true })}
          />
        </div>
        {errors.hourlyRate && <FieldError id="hourlyRate-error">{errors.hourlyRate.message}</FieldError>}
      </div>

      {/* Deposit */}
      <div className="space-y-4 rounded-xl border border-ink-800 bg-ink-900/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-parchment-200">
              Require a deposit <span className="font-normal text-ink-500">· optional</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Clients pay upfront to confirm — fewer no-shows, committed bookings.
              Leave this off to continue without a deposit.
            </p>
          </div>
          <Controller
            name="depositRequired"
            control={control}
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label={field.value ? 'Deposit required' : 'No deposit required'}
              />
            )}
          />
        </div>

        {depositRequired && (
          <div className="space-y-2 border-t border-ink-800 pt-4">
            <FieldLabel htmlFor="depositAmount" required>
              Deposit amount
            </FieldLabel>
            <div className={prefixWrapClass}>
              <span className="select-none border-r border-ink-700 bg-ink-950/40 py-3 px-4 text-sm text-ink-400">£</span>
              <input
                id="depositAmount"
                type="number"
                min={0}
                max={9999}
                step={0.01}
                placeholder="0.00"
                className="flex-1 bg-transparent py-3 px-3 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-required={depositRequired}
                aria-describedby={errors.depositAmount ? 'depositAmount-error' : undefined}
                {...register('depositAmount', { valueAsNumber: true })}
              />
            </div>
            {errors.depositAmount && (
              <FieldError id="depositAmount-error">{errors.depositAmount.message}</FieldError>
            )}
          </div>
        )}
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <FieldLabel htmlFor="timezone">Your timezone</FieldLabel>
        <select
          id="timezone"
          className={selectClass}
          aria-describedby={errors.timezone ? 'timezone-error' : undefined}
          {...register('timezone')}
        >
          {allTimezones.map((tz) => (
            <option key={tz} value={tz} className="bg-ink-900 text-parchment-100">
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {errors.timezone && <FieldError id="timezone-error">{errors.timezone.message}</FieldError>}
      </div>

      {/* Weekly availability */}
      <div className="space-y-3">
        <FieldLabel>Weekly availability</FieldLabel>
        <Hint>Select the days you accept bookings and set your hours.</Hint>

        <div className="space-y-2" role="group" aria-label="Weekly availability">
          {DAY_LABELS.map((label, dayIndex) => {
            const slot = availability?.find((s) => s.dayOfWeek === dayIndex)
            const active = !!slot

            return (
              <div
                key={dayIndex}
                className={cn(
                  'overflow-hidden rounded-lg border transition-all duration-150',
                  active ? 'border-gold-500/30 bg-ink-900/50' : 'border-ink-800 bg-ink-900/20',
                )}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    aria-label={`${label} available`}
                    onClick={() => toggleDay(dayIndex)}
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all duration-150',
                      active ? 'border-gold-500 bg-gold-500' : 'border-ink-600 hover:border-gold-500/60',
                    )}
                  >
                    {active && (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ink-950" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>

                  <span className={cn('w-10 text-sm font-medium', active ? 'text-parchment-100' : 'text-ink-500')}>
                    {label}
                  </span>

                  {active && slot ? (
                    <div className="ml-auto flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlotTime(dayIndex, 'startTime', e.target.value)}
                        aria-label={`${label} start time`}
                        className={timeInputClass}
                      />
                      <span className="text-xs text-ink-500">to</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlotTime(dayIndex, 'endTime', e.target.value)}
                        aria-label={`${label} end time`}
                        className={timeInputClass}
                      />
                    </div>
                  ) : (
                    <span className="ml-auto text-xs text-ink-700">Unavailable</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {errors.availability && (
          <FieldError>
            {typeof errors.availability.message === 'string'
              ? errors.availability.message
              : 'Availability configuration error'}
          </FieldError>
        )}
      </div>

      <WizardNav onBack={onBack} submitLabel="Continue" busy={busy} disabled={!isValid} />
    </form>
  )
}
