'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { submitContact, type ContactState } from './actions'

// ─── Submit button ─────────────────────────────────────────────────────────────
// Isolated so useFormStatus can read the nearest <form>'s pending state.

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  error,
  children,
}: {
  label:    string
  name:     string
  error?:   string[]
  children: React.ReactNode
}) {
  const id = `contact-${name}`

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-parchment-200 mb-1.5"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-crimson-400">
          {error[0]}
        </p>
      )}
    </div>
  )
}

const inputClass = cn(
  'w-full rounded-md border border-ink-700 bg-ink-900 px-4 py-2.5',
  'text-sm text-parchment-100 placeholder:text-ink-600',
  'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent',
  'transition-colors',
)

// ─── Form component ────────────────────────────────────────────────────────────

const initialState: ContactState = { success: false, message: '' }

export function ContactForm() {
  const [state, formAction] = useFormState(submitContact, initialState)

  if (state.success) {
    return (
      <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-8 text-center">
        <p className="text-2xl mb-3" aria-hidden>✓</p>
        <p className="font-semibold text-parchment-100 mb-2">Message sent</p>
        <p className="text-sm text-ink-400">{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} noValidate className="space-y-5">
      {/* Global error */}
      {!state.success && state.message && !state.errors && (
        <p className="rounded-md bg-crimson-500/10 border border-crimson-500/30 px-4 py-3 text-sm text-crimson-400">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Your name" name="name" error={state.errors?.name}>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-describedby={state.errors?.name ? 'contact-name-error' : undefined}
            className={inputClass}
            placeholder="Mia Torres"
          />
        </Field>

        <Field label="Email address" name="email" error={state.errors?.email}>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={state.errors?.email ? 'contact-email-error' : undefined}
            className={inputClass}
            placeholder="mia@example.com"
          />
        </Field>
      </div>

      <Field label="Subject" name="subject" error={state.errors?.subject}>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          aria-describedby={state.errors?.subject ? 'contact-subject-error' : undefined}
          className={inputClass}
          placeholder="Question about pricing"
        />
      </Field>

      <Field label="Message" name="message" error={state.errors?.message}>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          aria-describedby={state.errors?.message ? 'contact-message-error' : undefined}
          className={cn(inputClass, 'resize-y min-h-[120px]')}
          placeholder="Tell us what's on your mind…"
        />
      </Field>

      <SubmitButton />
    </form>
  )
}
