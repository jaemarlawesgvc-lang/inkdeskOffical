'use client'

/**
 * components/onboarding/ui.tsx
 *
 * Shared presentational primitives for the Inkquire onboarding flow.
 *
 * These keep every step visually consistent (premium ink/parchment/gold art
 * direction) without duplicating Tailwind class strings across five files.
 * They are deliberately presentational only — form state, validation and
 * `react-hook-form` registration stay inside each step component.
 */

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

// ─── Field class tokens ───────────────────────────────────────────────────────
// Imported directly by steps so native <input>/<textarea>/<select> can still be
// spread with react-hook-form's register().

/** Standalone input / textarea surface. */
export const fieldClass = cn(
  'w-full rounded-lg bg-ink-900/60 border border-ink-700 px-4 py-3',
  'text-sm text-parchment-100 placeholder:text-ink-500',
  'shadow-inset-top outline-none transition-colors duration-150',
  'focus:border-gold-500/60 focus:ring-1 focus:ring-gold-500/30',
)

export const textareaClass = cn(fieldClass, 'resize-none leading-relaxed')

// Native control kept (with a dark colour-scheme so the browser draws a
// legible arrow + dropdown) — avoids fragile Tailwind arbitrary bg-url values.
export const selectClass = cn(fieldClass, 'cursor-pointer [color-scheme:dark]')

/** Wrapper used for inputs that carry a fixed prefix (e.g. `inkdesk.live/`, `@`, `£`). */
export const prefixWrapClass = cn(
  'flex items-center overflow-hidden rounded-lg bg-ink-900/60 border border-ink-700',
  'shadow-inset-top transition-colors duration-150',
  'focus-within:border-gold-500/60 focus-within:ring-1 focus-within:ring-gold-500/30',
)

// ─── Step intro (eyebrow + display heading + lede) ────────────────────────────

export function StepIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="reveal is-visible">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold-500">
        {eyebrow}
      </span>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold leading-tight text-parchment-100">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-400">{description}</p>
      )}
    </div>
  )
}

// ─── Labels, errors, hints ────────────────────────────────────────────────────

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-parchment-300"
    >
      {children}
      {required && (
        <span className="ml-0.5 text-crimson-400" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-crimson-400">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      {children}
    </p>
  )
}

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs leading-relaxed text-ink-500">
      {children}
    </p>
  )
}

export function CharCount({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9
  return (
    <span
      className={cn('text-xs tabular-nums', near ? 'text-gold-400' : 'text-ink-600')}
      aria-label={`${value} of ${max} characters used`}
    >
      {value}/{max}
    </span>
  )
}

// ─── Selectable pill (style tags) ─────────────────────────────────────────────

export function TagPill({
  selected,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150',
        selected
          ? 'border-gold-500 bg-gold-500 text-ink-950 shadow-gold'
          : 'border-ink-700 bg-ink-900/40 text-parchment-300 hover:border-gold-500/50 hover:text-parchment-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50',
        checked ? 'bg-gold-500' : 'bg-ink-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5 bg-ink-950' : 'translate-x-0 bg-ink-400',
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}

// ─── Wizard navigation (Back + primary submit) ────────────────────────────────

export function WizardNav({
  onBack,
  backLabel = 'Back',
  submitLabel,
  busyLabel,
  busy = false,
  disabled = false,
  submitType = 'submit',
  onSubmit,
}: {
  onBack?: () => void
  backLabel?: string
  submitLabel: string
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  submitType?: 'submit' | 'button'
  /** Only used when submitType is 'button'. */
  onSubmit?: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={cn(
            'rounded-md px-5 py-3 text-sm font-semibold text-parchment-300 transition-colors duration-150',
            'border border-ink-700 hover:border-ink-500 hover:text-parchment-100',
            'disabled:opacity-40',
          )}
        >
          {backLabel}
        </button>
      )}
      <button
        type={submitType}
        onClick={submitType === 'button' ? onSubmit : undefined}
        disabled={disabled || busy}
        data-tour="continue"
        className={buttonVariants({
          variant: 'primary',
          size: 'lg',
          className: 'flex-1 justify-center disabled:bg-ink-800 disabled:text-ink-500 disabled:shadow-none',
        })}
      >
        {busy && (
          <svg
            className="-ml-1 mr-1 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {busy ? (busyLabel ?? 'Saving…') : submitLabel}
      </button>
    </div>
  )
}
