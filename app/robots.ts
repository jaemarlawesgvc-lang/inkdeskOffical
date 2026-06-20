/**
 * app/robots.ts
 *
 * Generates robots.txt for Inkquire.
 *
 * Disallows crawlers from:
 *   - /dashboard/*  (authenticated artist area)
 *   - /admin/*      (admin portal)
 *   - /api/*        (API routes)
 *   - /auth/*       (OAuth callback)
 *   - /onboarding/* (setup wizard)
 *
 * Points to the dynamic sitemap at /sitemap.xml.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

import { type MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkdesk.live'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/auth/',
          '/onboarding/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
