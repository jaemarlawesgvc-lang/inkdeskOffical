'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction, signInWithGoogle } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleIcon } from './google-icon'

// ─── Submit buttons ────────────────────────────────────────────────────────────

function EmailSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-1 w-full justify-center"
      aria-busy={pending}
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}

function GoogleSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-medium text-parchment-200 transition-all hover:border-ink-600 hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
      aria-busy={pending}
    >
      <GoogleIcon />
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </button>
  )
}

// ─── Props & state shape ───────────────────────────────────────────────────────

interface LoginFormProps {
  successMessage?: string | null
  errorMessage?: string | null
  defaultEmail?: string
}

const INITIAL_STATE = {
  success: false,
  message: '',
  errors: undefined as
    | {
        email?: string[]
        password?: string[]
      }
    | undefined,
}

// ─── LoginForm ────────────────────────────────────────────────────────────────

export function LoginForm({ successMessage, errorMessage, defaultEmail }: LoginFormProps) {
  const [formState, formAction] = useFormState(loginAction, INITIAL_STATE)
  const state = formState ?? INITIAL_STATE

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 shadow-lg">
        <h1 className="mb-1 font-display text-2xl font-bold text-parchment-100">
          Welcome back
        </h1>
        <p className="mb-7 text-sm text-ink-400">
          Sign in to your Inkquire account.
        </p>

        {/* URL-param banners */}
        {successMessage && (
          <div className="mb-5 rounded-md border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-400">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div
            className="mb-5 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {/* Action-level error (wrong credentials etc.) */}
        {state?.message && !state?.success && !state?.errors && (
          <div
            className="mb-5 rounded-md border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm text-crimson-400"
            role="alert"
          >
            {state.message}
          </div>
        )}

        {/* Email / password form */}
        <form action={formAction} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-parchment-200"
            >
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={defaultEmail}
              placeholder="you@example.com"
              error={state?.errors?.email?.[0]}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-parchment-200"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-gold-500 transition-colors hover:text-gold-400"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              error={state?.errors?.password?.[0]}
            />
          </div>

          <EmailSubmitButton />
        </form>

        {/* Divider */}
        <div className="relative my-6" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ink-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-ink-900 px-3 text-ink-600">or</span>
          </div>
        </div>

        {/* Google OAuth */}
        <form action={signInWithGoogle}>
          <GoogleSubmitButton />
        </form>
      </div>

      {/* Footer link */}
      <p className="mt-6 text-center text-sm text-ink-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-gold-500 transition-colors hover:text-gold-400"
        >
          Sign up free
        </Link>
      </p>
    </div>
  )
}