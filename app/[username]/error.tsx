'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function ArtistPageError({
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      <h1 className="font-serif text-5xl font-bold mb-3" style={{ color: '#f5f5f0' }}>
        Something went wrong
      </h1>
      <p className="text-white/50 text-base max-w-md mb-8">
        We couldn&rsquo;t load this page right now. This is usually temporary —
        please try again in a moment.
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
