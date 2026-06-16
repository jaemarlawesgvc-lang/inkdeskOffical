import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

/**
 * GET /auth/callback
 *
 * Handles all Supabase Auth code-exchange flows:
 *   - Google / GitHub OAuth (provider redirects here with ?code=...)
 *   - Email confirmation links
 *   - Password recovery links (?code=...&type=recovery)
 *
 * This route CANNOT use createSupabaseServerClient() from lib/supabase/server
 * because that helper writes to the global next/headers cookie store, which
 * is read-only at response time in Route Handlers.
 *
 * Instead, we create a minimal Supabase client whose setAll() writes cookies
 * directly onto the NextResponse object we're about to return. This ensures
 * the session cookies are present on the redirect, so the browser's first
 * request to /dashboard already carries a valid session.
 *
 * Redirect matrix:
 *   type=recovery    → /reset-password   (password reset flow)
 *   ?next=<path>     → <safe-path>       (post-login deep-link)
 *   default          → /dashboard
 *
 * Error:
 *   Code missing / exchange fails → /login?error=auth_callback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type')         // 'recovery' | 'signup' | null
  const nextPath = searchParams.get('next')

  // Determine the post-auth destination before creating the response.
  const destination = resolveDestination(type, nextPath)

  // Start building the redirect response so we can attach session cookies to it.
  const response = NextResponse.redirect(
    new URL(destination, request.url),
  )

  if (!code) {
    // No code means this wasn't a valid callback URL.
    return NextResponse.redirect(
      new URL('/login?error=auth_callback', request.url),
    )
  }

  // Build a Supabase client whose cookie setter writes directly onto `response`.
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          // Read cookies from the incoming request.
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Write session cookies onto the outgoing redirect response.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error(
      JSON.stringify({
        level:     'error',
        event:     'auth.callback.exchange_failed',
        error:     error.message,
        timestamp: new Date().toISOString(),
      }),
    )
    return NextResponse.redirect(
      new URL('/login?error=auth_callback', request.url),
    )
  }

  // Session cookies are now set on `response`; redirect the browser.
  return response
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine where to send the user after a successful code exchange.
 *
 * Security: the `next` parameter is validated to be a same-origin relative
 * path to prevent open-redirect attacks (CWE-601).
 */
function resolveDestination(
  type:     string | null,
  nextPath: string | null,
): string {
  // Recovery flow: the user clicked a password-reset link in email.
  if (type === 'recovery') return '/reset-password'

  // Honour a safe deep-link from the pre-auth redirect.
  if (nextPath && isSafePath(nextPath)) return nextPath

  return '/dashboard'
}

/**
 * Returns true only for same-origin relative paths that are not themselves
 * auth or callback URLs (which could cause redirect loops).
 */
function isSafePath(path: string): boolean {
  if (!path.startsWith('/'))    return false  // absolute URL
  if (path.startsWith('//'))   return false  // protocol-relative
  const UNSAFE = ['/login', '/signup', '/forgot-password', '/auth/']
  if (UNSAFE.some((p) => path.startsWith(p))) return false
  return true
}
