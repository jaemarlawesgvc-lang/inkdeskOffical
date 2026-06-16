/**
 * lib/supabase/server.ts  — SERVER ONLY
 *
 * Three Supabase client factories for server-side use:
 *
 *   createSupabaseServerClient()   — anon key, RLS enforced, cookie-backed.
 *                                    Use in Server Components, Server Actions,
 *                                    and Route Handlers for user-scoped reads.
 *
 *   createSupabaseServiceClient()  — service role key, RLS bypassed, still
 *                                    reads/writes the request cookie jar so
 *                                    the session is propagated correctly.
 *                                    Use in Server Actions that need elevated
 *                                    write access (booking creation, etc.).
 *
 *   createSupabaseAdminClient()    — service role key, RLS bypassed, NO cookie
 *                                    context. Use in webhook handlers and cron
 *                                    jobs where there is no active user session.
 *
 * ⚠️  Never pass createSupabaseServiceClient() or createSupabaseAdminClient()
 *     responses to the browser, and never call them from client components.
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

// ─── Helper: build cookie adapter for next/headers cookieStore ────────────────
// Extracted to avoid duplicating the try/catch pattern in every factory.
// The try/catch is required because cookies() is read-only in Server Components;
// attempting set() there throws. The session has already been refreshed by
// middleware before the Server Component renders, so this is non-fatal.

function buildCookieAdapter(cookieStore: ReturnType<typeof cookies>) {
  return {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
        )
      } catch {
        // Non-fatal in Server Component context (read-only cookieStore).
        // Middleware has already written the refreshed session cookie.
      }
    },
  }
}

// ─── User-scoped client (anon key — RLS enforced) ─────────────────────────────

/**
 * Create a Supabase client that runs as the authenticated user.
 * Row Level Security is fully enforced.
 *
 * @example
 * // Server Component or Server Action:
 * const supabase = createSupabaseServerClient()
 * const { data: artist } = await supabase
 *   .from('artists')
 *   .select('*')
 *   .eq('user_id', user.id)
 *   .single()
 */
export function createSupabaseServerClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: buildCookieAdapter(cookies()) },
  )
}

// ─── Service-role client (service role key — RLS bypassed, cookie-backed) ─────

/**
 * Create a Supabase client with the service role key that bypasses RLS.
 * Still uses the request cookie jar so the user session is propagated.
 *
 * Use for Server Actions that need to write data on behalf of a user
 * while bypassing RLS — e.g. creating a booking record for an anonymous
 * client, or upsert operations that span multiple tables.
 *
 * ⚠️  Must only be called in server-side code. Never expose the returned
 *     client or its query results to the browser without scrubbing.
 *
 * @example
 * // Server Action — creating a booking as service role:
 * const supabase = createSupabaseServiceClient()
 * await supabase.from('bookings').insert({ ... })
 */
export function createSupabaseServiceClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { cookies: buildCookieAdapter(cookies()) },
  )
}

// ─── Admin client (service role key — RLS bypassed, no cookie context) ────────

/**
 * Create a standalone Supabase client using the service role key.
 * No cookie jar — the auth session is not read or written.
 *
 * Use in:
 *   - Stripe webhook handlers (no user session present)
 *   - Cron job route handlers
 *   - Server-to-server operations in GDPR export/deletion flows
 *
 * ⚠️  This client has full unrestricted database access.
 *     Only call it from code paths that have already verified the request
 *     via an alternative mechanism (e.g. CRON_SECRET, Stripe signature).
 *
 * @example
 * // Webhook handler:
 * const supabase = createSupabaseAdminClient()
 * await supabase.from('stripe_events').insert({ ... })
 */
export function createSupabaseAdminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // Disable auto-refresh and session persistence — this client is
        // stateless and used for single-request server-to-server calls.
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
