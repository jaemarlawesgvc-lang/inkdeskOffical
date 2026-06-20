/**
 * middleware.ts  (project root)
 *
 * Next.js 14 App Router middleware. Runs on the Edge runtime before every
 * matched request.
 *
 * Responsibilities (in execution order):
 *   1. Skip requests that must never be intercepted (OAuth callbacks).
 *   2. Refresh the Supabase session on every request via updateSupabaseSession().
 *   3. Redirect unauthenticated users away from protected routes → /login.
 *   4. For authenticated users on routing-sensitive paths, fetch profile +
 *      artist in one query to determine onboarding status and admin role.
 *   5. Self-healing: if the auth user has no profile row (trigger failure),
 *      redirect to /onboarding which creates it via Server Action.
 *   6. Guard /admin routes — non-admins are sent to /dashboard.
 *   7. (Relaxed) /dashboard routes — currently allowed even if onboarding incomplete.
 *   8. Redirect authenticated users away from /login, /signup, etc. to their
 *      correct destination (onboarding or dashboard).
 *   9. (Disabled) /onboarding guard that sent completed users to /dashboard.
 *  10. Return the session-refreshed response for all other paths.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSupabaseSession } from '@/lib/supabase/middleware'
import { apiRateLimit, authRateLimit, webhookRateLimit } from '@/lib/redis/client'

// ─── Path Classification ───────────────────────────────────────────────────────

/** Routes that require authentication. Checked with startsWith(). */
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/onboarding'] as const

/**
 * Routes where authenticated users should not linger.
 */
const AUTH_PAGE_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
] as const

/**
 * Paths that must never be intercepted, regardless of auth state.
 */
const ALWAYS_ALLOW_PREFIXES = [
  '/auth/callback',
  '/auth/confirm',
  '/reset-password',
] as const

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGE_PREFIXES.some((p) => pathname.startsWith(p))
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin')
}

function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard')
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith('/onboarding')
}

function alwaysAllow(pathname: string): boolean {
  return ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))
}

// ─── Open-Redirect Guard ───────────────────────────────────────────────────────

function getSafeNext(nextParam: string | null): string {
  if (!nextParam) return '/dashboard'
  if (!nextParam.startsWith('/')) return '/dashboard'
  if (nextParam.startsWith('//')) return '/dashboard'
  if (isAuthPage(nextParam) || isOnboardingRoute(nextParam)) return '/dashboard'
  return nextParam
}

// ─── Profile Query Result ──────────────────────────────────────────────────────

interface ArtistRow {
  id: string
  onboarding_complete: boolean
}

interface ProfileWithArtist {
  role: string
  artists: ArtistRow[] | null
}

// ─── Middleware ────────────────────────────────────────────────────────────────

// Copy any cookies the session refresh wrote onto `response` over to a redirect
// (or other) response. Without this, returning a redirect from middleware drops
// the freshly-refreshed Supabase auth cookies, so the next request uses a stale
// token and the user has to refresh for it to work — the classic "have to
// refresh after signing in / confirming email" bug.
function withSessionCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Step 1 — Never intercept OAuth callback routes.
  if (alwaysAllow(pathname)) {
    return NextResponse.next({ request })
  }

  // Step 2 — Refresh the session.
  const { response, user, supabase } = await updateSupabaseSession(request)

  // Redirect helper that always carries the refreshed session cookies forward.
  const redirectTo = (to: URL | string) =>
    withSessionCookies(
      response,
      NextResponse.redirect(typeof to === 'string' ? new URL(to, request.url) : to),
    )

  // Step 2.5 — Rate Limiting
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'

  if (pathname.startsWith('/api/')) {
    let ratelimit = apiRateLimit
    if (pathname.startsWith('/api/webhooks')) {
      ratelimit = webhookRateLimit
    }

    try {
      const { success, limit, reset, remaining } = await ratelimit.limit(ip)
      if (!success) {
        return NextResponse.json({ error: 'Too Many Requests' }, {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        })
      }
    } catch (error) {
      console.warn(`[Rate Limiter] Connection or execution error (Failing Open):`, error)
    }
  }

  // Step 3 — Unauthenticated access to protected routes.
  if (isProtected(pathname) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectTo(loginUrl)
  }

  // Auth rate limiting (brute-force protection) — only on actual submissions
  // (POST: sign-in, sign-up, password reset, OAuth start). Previously this also
  // counted page loads and Next.js RSC prefetches, so just viewing the login
  // page a few times or retrying a password tripped "Too Many Requests".
  if (isAuthPage(pathname) && request.method === 'POST') {
    try {
      const { success } = await authRateLimit.limit(ip)
      if (!success) {
        return new NextResponse('Too Many Requests', { status: 429 })
      }
    } catch (error) {
      console.warn(`[Rate Limiter] Auth rate limit check failed (Failing Open):`, error)
    }
  }

  // Steps 4–9 — Authenticated user on a routing-sensitive path.
  if (user && (isProtected(pathname) || isAuthPage(pathname))) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        role,
        artists (
          id,
          onboarding_complete
        )
      `)
      .eq('id', user.id)
      .single()

    // Step 5 — Self-healing: auth user exists but profile row is missing.
    if (profileError || !profileData) {
      if (!isOnboardingRoute(pathname)) {
        return redirectTo('/onboarding')
      }
      return response
    }

    const profile = profileData as ProfileWithArtist
    const artist: ArtistRow | null =
      Array.isArray(profile.artists) && profile.artists.length > 0
        ? profile.artists[0] ?? null
        : null
    const onboardingComplete = artist?.onboarding_complete ?? false
    const isAdmin = profile.role === 'admin'

    // Step 6 — /admin routes: only users with role='admin' may access.
    if (isAdminRoute(pathname) && !isAdmin) {
      return redirectTo('/dashboard')
    }

    // Step 7 — /dashboard routes.
    // TEMP: allow dashboard even if onboarding is not complete to avoid loops.
    if (isDashboardRoute(pathname)) {
      // If you want to re‑enable later:
      // if (!onboardingComplete) {
      //   return NextResponse.redirect(new URL('/onboarding', request.url))
      // }
    }

    // Step 8 — Auth pages: authenticated users should not be here.
    if (isAuthPage(pathname)) {
      if (!onboardingComplete) {
        return redirectTo('/onboarding')
      }
      const nextParam = request.nextUrl.searchParams.get('next')
      return redirectTo(getSafeNext(nextParam))
    }

    // Step 9 — /onboarding: completed users don’t need to be here.
    // TEMP: disabled to avoid redirect loops between onboarding and dashboard.
    // if (isOnboardingRoute(pathname) && onboardingComplete) {
    //   return NextResponse.redirect(new URL('/dashboard', request.url))
    // }
  }

  // Step 10 — No redirect needed. Return the session-refreshed response.
  return response
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|monitoring).*)',
  ],
}