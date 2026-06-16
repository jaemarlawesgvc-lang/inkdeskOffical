'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { resetPasswordAction } from '@/lib/auth/actions'
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
      {pending ? 'Updating password…' : 'Set new password'}
    </Button>
  )
}

const INITIAL_STATE = {
  success: false,
  message: '',
  errors: undefined as
    | {
        password?: string[]
        confirmPassword?: string[]
      }
    | undefined,
}

// ─── ResetPasswordForm ────────────────────────────────────────────────────────

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(resetPasswordAction, INITIAL_STATE)

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 shadow-lg">
        <h1 className="font-display text-2xl font-bold text-parchment-100 mb-1">
          Set a new password
        </h1>
        <p className="text-sm text-ink-400 mb-7">
          Choose a strong password with at least 8 characters.
        </p>

        {/* Action-level error (e.g. expired link) */}
        {state.message && !state.success && !state.errors && (
          <div
            className="mb-5 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
            role="alert"
          >
            {state.message}{' '}
            {state.message.includes('expired') && (
              <a
                href="/forgot-password"
                className="underline hover:text-crimson-300"
              >
                Request a new link
              </a>
            )}
          </div>
        )}

        {/* Validation errors banner */}
        {state.message && !state.success && state.errors && (
          <div
            className="mb-5 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
            role="alert"
          >
            {state.message}
          </div>
        )}

        <form action={formAction} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-parchment-200 mb-1.5"
            >
              New password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
              error={state.errors?.password?.[0]}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-parchment-200 mb-1.5"
            >
              Confirm new password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter your password"
              error={state.errors?.confirmPassword?.[0]}
            />
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
