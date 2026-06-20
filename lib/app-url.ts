/**
 * lib/app-url.ts — SERVER ONLY
 *
 * Resolves the canonical base URL used to build absolute links in emails,
 * Stripe redirects and auth callbacks.
 *
 * Why this exists: NEXT_PUBLIC_APP_URL defaults to http://localhost:3000, and
 * if it's left at that on a deployment every generated link (e.g. the "Book
 * this slot" email button, Stripe success URLs, password-reset links) points
 * at localhost. This resolver falls back to the actual Vercel URL so deployed
 * environments never emit localhost links — even before NEXT_PUBLIC_APP_URL is
 * set to a custom domain.
 *
 * Reads Vercel system env vars (VERCEL_*) that are NOT exposed to the browser,
 * so call this from server code only.
 *
 * Preference order:
 *   1. NEXT_PUBLIC_APP_URL — when it's a real (non-localhost) URL.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production domain.
 *   3. VERCEL_URL — the current deployment's URL.
 *   4. NEXT_PUBLIC_APP_URL as-is (genuine local dev), else localhost.
 */

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '')

export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) {
    return stripTrailingSlash(explicit)
  }

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (prod) return `https://${stripTrailingSlash(prod)}`

  const deployment = process.env.VERCEL_URL?.trim()
  if (deployment) return `https://${stripTrailingSlash(deployment)}`

  return explicit ? stripTrailingSlash(explicit) : 'http://localhost:3000'
}
