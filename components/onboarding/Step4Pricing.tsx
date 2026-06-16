'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step4Schema, type Step4Values, type AvailabilitySlot } from '@/lib/validations/onboarding'

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
      depositRequired: defaultValues.depositRequired ?? true,
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
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Pricing &amp; availability</h2>
        <p className="text-white/60 text-sm">
          Let clients know your rates and when you&apos;re available.
        </p>
      </div>

      {/* Hourly rate */}
      <div className="space-y-2">
        <label htmlFor="hourlyRate" className="block text-sm font-medium text-white/80">
          Hourly rate
        </label>
        <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/60 transition-all duration-150 bg-white/5">
          <span className="pl-4 pr-2 text-white/40 text-sm">£</span>
          <input
            id="hourlyRate"
            type="number"
            min={0}
            max={9999}
            step={0.01}
            placeholder="0.00"
            className="flex-1 bg-transparent py-3 pr-4 text-white placeholder-white/25 text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-describedby={errors.hourlyRate ? 'hourlyRate-error' : undefined}
            {...register('hourlyRate', { valueAsNumber: true })}
          />
        </div>
        {errors.hourlyRate && (
          <p id="hourlyRate-error" className="text-red-400 text-sm" role="alert">
            {errors.hourlyRate.message}
          </p>
        )}
      </div>

      {/* Deposit toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Require a deposit</p>
            <p className="text-white/40 text-xs mt-0.5">
              Clients must pay upfront to confirm their booking
            </p>
          </div>
          <Controller
            name="depositRequired"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={[
                  'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50',
                  field.value ? 'bg-white' : 'bg-white/20',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200',
                    field.value ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/60',
                  ].join(' ')}
                />
                <span className="sr-only">{field.value ? 'Deposit required' : 'No deposit required'}</span>
              </button>
            )}
          />
        </div>

        {/* Deposit amount (shown when deposit required) */}
        {depositRequired && (
          <div className="space-y-2">
            <label htmlFor="depositAmount" className="block text-sm font-medium text-white/80">
              Deposit amount <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/60 transition-all duration-150 bg-white/5">
              <span className="pl-4 pr-2 text-white/40 text-sm">£</span>
              <input
                id="depositAmount"
                type="number"
                min={0}
                max={9999}
                step={0.01}
                placeholder="0.00"
                className="flex-1 bg-transparent py-3 pr-4 text-white placeholder-white/25 text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-required={depositRequired}
                aria-describedby={errors.depositAmount ? 'depositAmount-error' : undefined}
                {...register('depositAmount', { valueAsNumber: true })}
              />
            </div>
            {errors.depositAmount && (
              <p id="depositAmount-error" className="text-red-400 text-sm" role="alert">
                {errors.depositAmount.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <label htmlFor="timezone" className="block text-sm font-medium text-white/80">
          Your timezone
        </label>
        <select
          id="timezone"
          className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white/60 transition-colors duration-150 appearance-none"
          aria-describedby={errors.timezone ? 'timezone-error' : undefined}
          {...register('timezone')}
        >
          {allTimezones.map((tz) => (
            <option key={tz} value={tz} className="bg-zinc-900 text-white">
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p id="timezone-error" className="text-red-400 text-sm" role="alert">
            {errors.timezone.message}
          </p>
        )}
      </div>

      {/* Weekly availability grid */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-white/80">Weekly availability</p>
        <p className="text-white/40 text-xs">Select the days you accept bookings.</p>

        <div className="space-y-2" role="group" aria-label="Weekly availability">
          {DAY_LABELS.map((label, dayIndex) => {
            const slot = availability?.find((s) => s.dayOfWeek === dayIndex)
            const active = !!slot

            return (
              <div
                key={dayIndex}
                className={[
                  'rounded-lg border transition-all duration-150 overflow-hidden',
                  active ? 'border-white/30 bg-white/5' : 'border-white/10 bg-transparent',
                ].join(' ')}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    aria-label={`${label} available`}
                    onClick={() => toggleDay(dayIndex)}
                    className={[
                      'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-150',
                      active
                        ? 'bg-white border-white'
                        : 'border-white/30 hover:border-white/60',
                    ].join(' ')}
                  >
                    {active && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="black"
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>

                  <span
                    className={[
                      'w-12 text-sm font-medium',
                      active ? 'text-white' : 'text-white/40',
                    ].join(' ')}
                  >
                    {label}
                  </span>

                  {active && slot && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlotTime(dayIndex, 'startTime', e.target.value)}
                        aria-label={`${label} start time`}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/60 [color-scheme:dark]"
                      />
                      <span className="text-white/40 text-xs">to</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlotTime(dayIndex, 'endTime', e.target.value)}
                        aria-label={`${label} end time`}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/60 [color-scheme:dark]"
                      />
                    </div>
                  )}

                  {!active && (
                    <span className="ml-auto text-white/20 text-xs">Unavailable</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {errors.availability && (
          <p className="text-red-400 text-sm" role="alert">
            {typeof errors.availability.message === 'string'
              ? errors.availability.message
              : 'Availability configuration error'}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex-1 py-3 rounded-lg text-sm font-semibold text-white/60 border border-white/20 hover:border-white/50 hover:text-white transition-all duration-150 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!isValid || busy}
          className={[
            'flex-[2] py-3 rounded-lg font-semibold text-sm transition-all duration-150',
            isValid && !busy
              ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
              : 'bg-white/10 text-white/30 cursor-not-allowed',
          ].join(' ')}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
