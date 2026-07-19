'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Top-level boundary: catches errors thrown in the root layout itself. It must
// render its own <html>/<body> because it replaces the entire document.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 1.5rem',
          background: '#000',
          color: '#f5f5f0',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '28rem', margin: '0 0 2rem' }}>
          An unexpected error occurred. Please try again — if the problem persists,
          reload the page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#fff',
            color: '#000',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
