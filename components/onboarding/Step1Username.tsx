'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step1Schema, type Step1Values } from '@/lib/validations/onboarding'
import {
  StepIntro,
  FieldLabel,
  FieldError,
  Hint,
  CharCount,
  WizardNav,
  prefixWrapClass,
} from '@/components/onboarding/ui'

interface Step1Props {
  defaultValues: Partial<Step1Values>
  onNext: (data: Step1Values) => Promise<void>
  isSaving: boolean
}

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

const MAX_LENGTH = 30

export function Step1Username({ defaultValues, onNext, isSaving }: Step1Props) {
  const [availability, setAvailability] = useState<AvailabilityState>('idle')
  const [availabilityMessage, setAvailabilityMessage] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { username: defaultValues.username ?? '' },
    mode: 'onChange',
  })

  const username = watch('username') ?? ''

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!username || username.length < 3) {
      setAvailability('idle')
      setAvailabilityMessage('')
      return
    }

    setAvailability('checking')
    setAvailabilityMessage('')

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/check-username?username=${encodeURIComponent(username)}`,
        )
        const json = (await res.json()) as { available: boolean; error?: string }

        if (json.available) {
          setAvailability('available')
          setAvailabilityMessage('That username is available')
        } else {
          setAvailability('taken')
          setAvailabilityMessage(json.error ?? 'That username is already taken')
        }
      } catch {
        setAvailability('error')
        setAvailabilityMessage('Could not check availability')
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username])

  const isFormValid =
    !errors.username && username.length >= 3 && availability === 'available'
  const busy = isSubmitting || isSaving

  const availabilityIndicator = () => {
    switch (availability) {
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-sm text-ink-400" aria-live="polite">
            <span className="h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold-500" />
            Checking availability…
          </span>
        )
      case 'available':
        return (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400" aria-live="polite">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {availabilityMessage}
          </span>
        )
      case 'taken':
      case 'error':
        return <FieldError>{availabilityMessage}</FieldError>
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-8">
      <StepIntro
        eyebrow="Step 1 · Username"
        title="Claim your address"
        description="This becomes your public booking page URL — permanent once you go live, so choose with care."
      />

      <div className="space-y-3">
        <FieldLabel htmlFor="username">Username</FieldLabel>

        <div className={prefixWrapClass}>
          <span className="whitespace-nowrap select-none border-r border-ink-700 bg-ink-950/40 py-3 pl-4 pr-3 text-sm text-ink-400">
            inkdesk.co/
          </span>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={MAX_LENGTH}
            placeholder="your-name"
            className="flex-1 bg-transparent py-3 pl-3 pr-2 text-sm text-parchment-100 placeholder:text-ink-600 focus:outline-none"
            {...register('username', {
              setValueAs: (v: string) => v.toLowerCase().replace(/\s/g, '-'),
            })}
            aria-describedby="username-hint username-availability username-error"
          />
          <span className="pr-4">
            <CharCount value={username.length} max={MAX_LENGTH} />
          </span>
        </div>

        {/* Availability indicator */}
        <div id="username-availability" className="min-h-[1.25rem]">
          {!errors.username && availabilityIndicator()}
        </div>

        {/* Validation error */}
        {errors.username && <FieldError id="username-error">{errors.username.message}</FieldError>}

        <Hint id="username-hint">
          3–30 characters. Lowercase letters, numbers, and hyphens only.
        </Hint>
      </div>

      {/* Live URL preview */}
      {username.length >= 3 && !errors.username && (
        <div className="overflow-hidden rounded-xl border border-gold-500/20 bg-gradient-surface p-4 shadow-inset-top">
          <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-widest text-ink-500">
            Your public booking page
          </p>
          <p className="font-mono text-sm text-ink-300">
            inkdesk.co/
            <span className="font-semibold text-gold-400">{username}</span>
          </p>
        </div>
      )}

      <WizardNav submitLabel="Continue" busy={busy} disabled={!isFormValid} />
    </form>
  )
}
