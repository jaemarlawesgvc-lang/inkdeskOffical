'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full justify-center"
      aria-busy={pending}
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </Button>
  )
}

const INITIAL_STATE = {
  success: false,
  message: '',
  errors: undefined as
    | {
        email?: string[]
      }
    | undefined,
}

// ─── ForgotPasswordForm ───────────────────────────────────────────────────────

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, INITIAL_STATE)

  // Success: always show the same message regardless of whether the email exists.
  if (state.success) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-8 text-center">
          <p className="text-3xl mb-4" aria-hidden>📬</p>
          <h2 className="font-display text-xl font-bold text-parchment-100 mb-2">
            Check your inbox
          </h2>
          <p className="text-sm text-ink-400 leading-relaxed">{state.message}</p>
        </div>
        <p className="mt-6 text-center text-sm text-ink-500">
          <Link
            href="/login"
            className="text-gold-500 hover:text-gold-400 transition-colors font-medium"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 shadow-lg">
        <h1 className="font-display text-2xl font-bold text-parchment-100 mb-1">
          Forgot your password?
        </h1>
        <p className="text-sm text-ink-400 mb-7">
          Enter the email address on your account and we&apos;ll send a reset
          link if it exists.
        </p>

        {/* Field-level or action-level error */}
        {state.message && !state.success && (
          <div
            className="mb-5 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
            role="alert"
          >
            {state.message}
          </div>
        )}

        <form action={formAction} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-parchment-200 mb-1.5"
            >
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              error={state.errors?.email?.[0]}
            />
          </div>

          <SubmitButton />
        </form>
      </div>

      {/* Footer link */}
      <p className="mt-6 text-center text-sm text-ink-500">
        Remembered it?{' '}
        <Link
          href="/login"
          className="text-gold-500 hover:text-gold-400 transition-colors font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
