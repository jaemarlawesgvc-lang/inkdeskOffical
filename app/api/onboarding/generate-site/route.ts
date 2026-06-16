import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  callGemini,
  buildSitePrompt,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
  type SiteData,
} from '@/lib/gemini/client'

// Re-export SiteData so Step5GenerateSite.tsx import remains valid
export type { SiteData }

// ---------------------------------------------------------------------------
// POST /api/onboarding/generate-site
// Onboarding step 5 — no plan enforcement (free first generation)
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Load artist + portfolio images
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select(
      'id, display_name, bio, style_tags, onboarding_step, portfolio_images(public_url)',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist record not found' }, { status: 404 })
  }

  if ((artist.onboarding_step ?? 1) < 5) {
    return NextResponse.json(
      { error: 'Complete all previous onboarding steps first' },
      { status: 422 },
    )
  }

  const portfolioImages =
    (artist.portfolio_images as { public_url: string }[] | null) ?? []
  const styleTags: string[] = Array.isArray(artist.style_tags)
    ? artist.style_tags
    : []

  const prompt = buildSitePrompt({
    displayName: artist.display_name ?? 'Unknown Artist',
    bio: artist.bio ?? '',
    styleTags,
    portfolioImageCount: portfolioImages.length,
  })

  let siteData: SiteData
  try {
    siteData = await callGemini(prompt)
  } catch (err) {
    console.error('[onboarding/generate-site] Gemini error:', err instanceof Error ? err.message : err)

    if (err instanceof GeminiTimeoutError) {
      return NextResponse.json(
        { error: 'AI generation timed out. Please try again.' },
        { status: 504 },
      )
    }

    if (err instanceof GeminiInvalidResponseError) {
      return NextResponse.json(
        { error: 'AI generation returned an invalid response. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { error: 'AI generation failed. Please try again.' },
      { status: 500 },
    )
  }

  // Persist site data and mark onboarding complete
  const { error: updateError } = await supabase
    .from('artists')
    .update({
      site_data: siteData,
      site_generated: true,
      onboarding_complete: true,
      onboarding_step: 5,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artist.id)

  if (updateError) {
    console.error('[onboarding/generate-site] DB update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save generated site' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, siteData })
}
