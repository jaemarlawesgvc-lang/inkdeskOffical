/**
 * lib/env.client.ts
 *
 * Safe to import in both Server Components and Client Components.
 * Only exposes NEXT_PUBLIC_ environment variables — values that Next.js
 * deliberately inlines into the client bundle at build time.
 *
 * Does NOT perform runtime validation (values are substituted at build time).
 * For server-side validation of all variables, see lib/env.ts.
 *
 * @example
 * // In a Client Component:
 * import { clientEnv } from '@/lib/env.client'
 * const supabase = createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey)
 */

export const clientEnv = {
  supabaseUrl:          process.env.NEXT_PUBLIC_SUPABASE_URL            as string,
  supabaseAnonKey:      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY       as string,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  as string,
  appUrl:               process.env.NEXT_PUBLIC_APP_URL                 as string,
  appName:              process.env.NEXT_PUBLIC_APP_NAME                as string,
  // Optional — undefined when Sentry is not configured (e.g. local dev)
  sentryDsn:            process.env.NEXT_PUBLIC_SENTRY_DSN,
} as const

export type ClientEnv = typeof clientEnv
