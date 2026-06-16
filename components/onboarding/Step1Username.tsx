'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { step1Schema, type Step1Values } from '@/lib/validations/onboarding'

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

  const availabilityIcon = () => {
    switch (availability) {
      case 'checking':
        return (
          <span className="text-white/40 text-sm animate-pulse" aria-live="polite">
            Checking…
          </span>
        )
      case 'available':
        return (
          <span className="text-emerald-400 text-sm flex items-center gap-1" aria-live="polite">
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
            {availabilityMessage}
          </span>
        )
      case 'taken':
      case 'error':
        return (
          <span className="text-red-400 text-sm flex items-center gap-1" aria-live="polite">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {availabilityMessage}
          </span>
        )
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Choose your username</h2>
        <p className="text-white/60 text-sm">
          This becomes your public URL. You can&apos;t change it later.
        </p>
      </div>

      <div className="space-y-3">
        <label htmlFor="username" className="block text-sm font-medium text-white/80">
          Username
        </label>

        {/* Input row */}
        <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-white/20 focus-within:ring-white/60 transition-all duration-150 bg-white/5">
          <span className="pl-4 pr-1 text-white/40 text-sm select-none whitespace-nowrap">
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
            className="flex-1 bg-transparent py-3 pr-4 text-white placeholder-white/25 focus:outline-none text-sm"
            {...register('username', {
              setValueAs: (v: string) => v.toLowerCase().replace(/\s/g, '-'),
            })}
            aria-describedby="username-hint username-availability username-error"
          />
          <span
            className={[
              'pr-4 text-xs tabular-nums',
              username.length > MAX_LENGTH * 0.9 ? 'text-amber-400' : 'text-white/30',
            ].join(' ')}
            aria-label={`${username.length} of ${MAX_LENGTH} characters used`}
          >
            {username.length}/{MAX_LENGTH}
          </span>
        </div>

        {/* Availability indicator */}
        <div id="username-availability" className="h-5">
          {!errors.username && availabilityIcon()}
        </div>

        {/* Validation error */}
        {errors.username && (
          <p id="username-error" className="text-red-400 text-sm" role="alert">
            {errors.username.message}
          </p>
        )}

        {/* Hint */}
        <p id="username-hint" className="text-white/40 text-xs">
          3–30 characters. Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {/* Live URL preview */}
      {username.length >= 3 && !errors.username && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-white/40 mb-1">Your public booking page will be</p>
          <p className="text-white font-mono text-sm">
            inkdesk.co/
            <span className="text-white font-semibold">{username}</span>
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || busy}
        className={[
          'w-full py-3 rounded-lg font-semibold text-sm transition-all duration-150',
          isFormValid && !busy
            ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
            : 'bg-white/10 text-white/30 cursor-not-allowed',
        ].join(' ')}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}
