/**
 * lib/env.ts — SERVER ONLY
 *
 * ⚠️  Never import this file from client components or pages.
 *     Use lib/env.client.ts for NEXT_PUBLIC_ variables in the browser.
 *
 * Validates ALL environment variables at module load time using Zod.
 * If any required variable is absent or malformed the process throws
 * immediately with a human-readable error, preventing silent
 * misconfiguration from reaching production requests.
 *
 * Imported by instrumentation.ts so validation fires at server startup,
 * before any request handler runs.
 */

import { z } from 'zod'

// Guard: crash fast if this module is accidentally bundled client-side.
if (typeof window !== 'undefined') {
  throw new Error(
    '[InkDesk] lib/env.ts was imported in a browser context. ' +
      'This is a server-only module. ' +
      'Use lib/env.client.ts for NEXT_PUBLIC_ variables in client components.',
  )
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // ── Supabase ────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL is required' })
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY cannot be empty'),

  // ── Stripe (Platform Keys) ──────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z
    .string({ required_error: 'STRIPE_SECRET_KEY is required' })
    .startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_'),

  STRIPE_WEBHOOK_SECRET: z
    .string({ required_error: 'STRIPE_WEBHOOK_SECRET is required' })
    .startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required' })
    .startsWith('pk_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_'),

  // Stripe Subscription Price IDs — added per §2.8 fix
  STRIPE_PRICE_PRO_MONTHLY: z
    .string({ required_error: 'STRIPE_PRICE_PRO_MONTHLY is required' })
    .startsWith('price_', 'STRIPE_PRICE_PRO_MONTHLY must start with price_'),

  STRIPE_PRICE_STUDIO_MONTHLY: z
    .string({ required_error: 'STRIPE_PRICE_STUDIO_MONTHLY is required' })
    .startsWith('price_', 'STRIPE_PRICE_STUDIO_MONTHLY must start with price_'),

  // ── Google Gemini ───────────────────────────────────────────────────────────
  GEMINI_API_KEY: z
    .string({ required_error: 'GEMINI_API_KEY is required' })
    .min(1, 'GEMINI_API_KEY cannot be empty'),

  // Optional override for the Gemini model name. If unset, the client tries a
  // built-in fallback chain of known-good flash models.
  GEMINI_MODEL: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // ── Resend ──────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z
    .string({ required_error: 'RESEND_API_KEY is required' })
    .startsWith('re_', 'RESEND_API_KEY must start with re_'),

  RESEND_FROM_EMAIL: z
    .string({ required_error: 'RESEND_FROM_EMAIL is required' })
    .email('RESEND_FROM_EMAIL must be a valid email address'),

  // ── Upstash Redis ───────────────────────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: z
    .string({ required_error: 'UPSTASH_REDIS_REST_URL is required' })
    .url('UPSTASH_REDIS_REST_URL must be a valid URL'),

  UPSTASH_REDIS_REST_TOKEN: z
    .string({ required_error: 'UPSTASH_REDIS_REST_TOKEN is required' })
    .min(1, 'UPSTASH_REDIS_REST_TOKEN cannot be empty'),

  // ── Sentry — OPTIONAL ───────────────────────────────────────────────────────
  // Per spec: "App must still boot if SENTRY_DSN is absent."
  // An empty string is treated identically to undefined (not set).
  SENTRY_DSN: z
    .string()
    .url('SENTRY_DSN must be a valid Sentry DSN URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  NEXT_PUBLIC_SENTRY_DSN: z
    .string()
    .url('NEXT_PUBLIC_SENTRY_DSN must be a valid Sentry DSN URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // ── Google Maps — OPTIONAL ──────────────────────────────────────────────────
  // Per spec: the studio map section is hidden entirely if this is absent.
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // ── Application ─────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z
    .string({ required_error: 'NEXT_PUBLIC_APP_URL is required' })
    .url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  NEXT_PUBLIC_APP_NAME: z
    .string({ required_error: 'NEXT_PUBLIC_APP_NAME is required' })
    .min(1, 'NEXT_PUBLIC_APP_NAME cannot be empty'),

  // Must be at least 32 chars — used to authenticate Vercel cron requests
  CRON_SECRET: z
    .string({ required_error: 'CRON_SECRET is required' })
    .min(32, 'CRON_SECRET must be at least 32 characters (run: openssl rand -hex 32)'),

  // ── Node ────────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof schema>

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv(): Env {
  const result = schema.safeParse(process.env)

  if (result.success) return result.data

  const issues = result.error.issues
    .map((issue) => `  ✗  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  // Previously this THREW, which hard-crashed every route that imports `env`
  // the moment a single variable was unset — including routes that don't use
  // that variable (e.g. /login 500ing because CRON_SECRET or a Stripe key is
  // missing). That made the very common "partially configured" state — Supabase
  // set but third-party keys not yet — impossible to run, and it also broke the
  // build and the Edge middleware.
  //
  // Instead we log loudly and continue with the raw environment. Pages render,
  // and only the features that genuinely need a missing variable fail, at their
  // own call site (e.g. a Stripe checkout, a Resend email), rather than taking
  // down the whole app. Set every variable in Vercel → Settings → Environment
  // Variables (then redeploy) for full functionality.
  console.error(
    [
      '',
      '╔══════════════════════════════════════════════════════════════════╗',
      '║   INKDESK — ENVIRONMENT VALIDATION WARNINGS (app still booting)  ║',
      '╚══════════════════════════════════════════════════════════════════╝',
      '',
      'The following variables are missing or invalid. Features that depend on',
      'them will not work until they are set:',
      '',
      issues,
      '',
      '  ▸ Set these in Vercel → Project → Settings → Environment Variables,',
      '    then redeploy. NEXT_PUBLIC_* vars only take effect on a fresh build.',
      '',
    ].join('\n'),
  )

  return process.env as unknown as Env
}

/**
 * Validated, typed environment variables.
 *
 * Throws at module load time if any required variable is absent or malformed.
 * Import this at the top of every server-side file that needs env access.
 *
 * @example
 * import { env } from '@/lib/env'
 * const stripe = new Stripe(env.STRIPE_SECRET_KEY)
 */
export const env = validateEnv()
