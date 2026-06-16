/**
 * Next.js 14 Instrumentation Hook
 *
 * This file runs once when the Next.js server initialises, before any request
 * is handled. We use it to validate all required environment variables at
 * startup so that misconfiguration is caught immediately with a clear error
 * message rather than surfacing as a cryptic runtime failure in production.
 *
 * Enabled via: experimental.instrumentationHook = true in next.config.ts
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run env validation in the Node.js runtime.
  // The Edge runtime handles middleware and has a different env context.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import ensures:
    // 1. The module (and its validation throw) only executes server-side
    // 2. Vitest can mock the module cleanly without triggering validation
    const { env } = await import('./lib/env')

    // Log a structured startup event confirming the server booted cleanly.
    // This appears in Vercel Function Logs and Sentry breadcrumbs.
    console.log(
      JSON.stringify({
        level:          'info',
        event:          'server.startup',
        nodeEnv:        env.NODE_ENV,
        appUrl:         env.NEXT_PUBLIC_APP_URL,
        sentryEnabled:  Boolean(env.SENTRY_DSN),
        timestamp:      new Date().toISOString(),
      })
    )
  }
}
