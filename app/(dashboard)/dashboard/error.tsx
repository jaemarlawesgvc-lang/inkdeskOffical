'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <h1 className="font-serif text-3xl font-bold mb-3 text-parchment-100">
        Something went wrong
      </h1>
      <p className="text-parchment-300/60 text-sm max-w-md mb-8">
        We couldn&rsquo;t load this part of your dashboard. This is usually
        temporary — please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
