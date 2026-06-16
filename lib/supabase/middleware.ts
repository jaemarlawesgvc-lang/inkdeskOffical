/**
 * lib/supabase/middleware.ts
 *
 * Supabase session refresh helper consumed by root middleware.ts.
 *
 * Responsibilities:
 *   1. Create a Supabase client wired to the edge-compatible cookie API
 *      (request/response cookies rather than next/headers).
 *   2. Call getUser() to validate the JWT server-side and refresh the session
 *      if the access token has expired.
 *   3. Propagate any updated session cookies to:
 *        (a) the current request object — so subsequent supabase calls within
 *            this same middleware invocation see the new token.
 *        (b) the response object — so the browser persists the refreshed token.
 *   4. Return the updated response, the authenticated user (or null), and the
 *      Supabase client so root middleware.ts can reuse it for additional queries
 *      (e.g. checking onboarding status) without creating a second client.
 *
 * ⚠️  Uses getUser() — NOT getSession().
 *     getSession() only decodes the JWT from the cookie locally, without
 *     verifying it against the Supabase Auth server. A tampered cookie would
 *     pass getSession(). getUser() makes a server-side round-trip to verify.
 *
 * Uses NEXT_PUBLIC_* vars directly (not lib/env.ts) because this module is
 * imported by root middleware.ts which runs on the Edge runtime. NEXT_PUBLIC_*
 * vars are always available in all Next.js runtimes.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

export interface UpdateSessionResult {
  /**
   * The NextResponse with refreshed session cookies written.
   * Return this directly from middleware.ts if no redirect is needed.
   * If redirecting, clone its cookies onto the redirect response.
   */
  response: NextResponse
  /**
   * The validated authenticated user, or null if:
   *   - No session cookie present (unauthenticated)
   *   - JWT is invalid or expired and refresh failed
   *   - Supabase Auth server returned an error
   */
  user: User | null
  /**
   * The Supabase client used for this request.
   * Reuse in root middleware.ts for additional queries (profile, onboarding
   * status, admin role) so a second client is not created.
   */
  supabase: SupabaseClient
}

/**
 * Refresh the Supabase session and return routing context.
 *
 * Must be called on every middleware invocation (except paths excluded by the
 * matcher). The returned `response` must be the base for all subsequent
 * NextResponse operations to ensure session cookies are not lost.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  // Start with a pass-through response that forwards the request unchanged.
  // This reference is reassigned inside setAll() if the session is refreshed
  // (i.e. if @supabase/ssr decides to write new cookies).
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        /**
         * Read cookies from the incoming request.
         * @supabase/ssr calls this to load the current session token.
         */
        getAll() {
          return request.cookies.getAll()
        },

        /**
         * Write updated cookies to both the request and the response.
         *
         * Two-target write is essential:
         *   - request: so that subsequent supabase calls in THIS middleware
         *     invocation (e.g. the profile query in root middleware.ts) use
         *     the newly refreshed access token rather than the expired one.
         *   - response: so the browser receives and persists the new token.
         *
         * Each call to setAll() also rebuilds the response with `request`
         * carrying the updated cookies, ensuring all request headers are
         * forwarded to the origin correctly.
         */
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // 1. Update the request-side cookies for this invocation.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // 2. Rebuild the response so Next.js forwards the right request
          //    headers, then write the new cookies onto it.
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Validate the JWT with the Supabase Auth server.
  // If the access token is expired, @supabase/ssr automatically uses the
  // refresh token to obtain a new one, triggering setAll() above.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    response,
    // Treat any auth error as unauthenticated — never expose a potentially
    // invalid user object to the routing logic.
    user: error ? null : user,
    supabase: supabase as SupabaseClient,
  }
}
