/**
 * app/sitemap.ts
 *
 * Dynamic sitemap generation for InkDesk.
 *
 * Includes:
 *   - Static marketing pages
 *   - All public artist pages (onboarding complete, not soft-deleted)
 *
 * Excludes (via robots.txt):
 *   - /dashboard/*, /admin/*, /auth/*, /onboarding/*
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import { type MetadataRoute } from 'next'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkdesk.live'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static marketing pages ─────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/features`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // ── Dynamic artist pages ───────────────────────────────────────────────────
  const supabase = createSupabaseAdminClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('username, updated_at')
    .eq('onboarding_complete', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  const artistPages: MetadataRoute.Sitemap = (artists ?? []).map((artist) => ({
    url: `${BASE_URL}/${artist.username}`,
    lastModified: artist.updated_at ? new Date(artist.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...artistPages]
}
