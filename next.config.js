const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@sentry/nextjs', '@sentry/node'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    // Content-Security-Policy in Report-Only mode: it never blocks a request,
    // only reports violations, so it cannot break the running app. Once the
    // reports are clean the same value can be promoted to a blocking
    // `Content-Security-Policy` header. Sources are intentionally conservative:
    //   - self for first-party assets
    //   - Stripe (js.stripe.com script + frame, api.stripe.com XHR)
    //   - Supabase (*.supabase.co REST/storage/realtime; wss for realtime)
    //   - Sentry (ingest endpoints; note tunnelRoute '/monitoring' proxies most
    //     traffic through self already)
    //   - Google — Gemini (generativelanguage.googleapis.com) + Maps
    // 'unsafe-inline'/'unsafe-eval' are included for script/style because Next.js
    // injects inline runtime/styles; these can be tightened with nonces later.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://js.stripe.com https://*.ingest.sentry.io https://*.sentry.io https://generativelanguage.googleapis.com https://maps.googleapis.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
}

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG ?? '',
  project: process.env.SENTRY_PROJECT ?? 'inkdesk',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
}

module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig