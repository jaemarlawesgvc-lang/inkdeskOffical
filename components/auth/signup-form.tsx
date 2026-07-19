'use client'

import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { signupAction } from '@/lib/auth/actions'

type SignupState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

const INITIAL_STATE: SignupState = {
  success: false,
  message: '',
  errors: {},
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Creating account...' : 'Create account'}
    </button>
  )
}

export function SignupForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, formAction] = useFormState(signupAction, INITIAL_STATE)

  if (state?.success) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-parchment-100">
            Check your inbox
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-300">
            {state.message}
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-gold-400"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-ink-800 bg-ink-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-parchment-100">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            Start building your tattoo portfolio, bookings, and client flow.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-parchment-100"
            >
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-parchment-100 outline-none transition placeholder:text-ink-500 focus:border-gold-500"
              placeholder="Jane Doe"
            />
            {state?.errors?.fullName?.[0] && (
              <p className="mt-2 text-sm text-red-400">
                {state.errors.fullName[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-parchment-100"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={defaultEmail}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-parchment-100 outline-none transition placeholder:text-ink-500 focus:border-gold-500"
              placeholder="you@example.com"
            />
            {state?.errors?.email?.[0] && (
              <p className="mt-2 text-sm text-red-400">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-parchment-100"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-parchment-100 outline-none transition placeholder:text-ink-500 focus:border-gold-500"
              placeholder="Create a secure password"
            />
            {state?.errors?.password?.[0] && (
              <p className="mt-2 text-sm text-red-400">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {state?.message && !state.success && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {state.message}
            </div>
          )}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-ink-400">
          Already have an account?{' '}
          <Link href="/login" className="text-gold-500 hover:text-gold-400">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}