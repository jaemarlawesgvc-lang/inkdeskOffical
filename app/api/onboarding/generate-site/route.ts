import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  callGemini,
  buildSitePrompt,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
  type SiteData,
} from '@/lib/gemini/client'
import { resolveActivePlan, checkMeteredFeature } from '@/lib/stripe/plans'

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

  // ── Plan enforcement ──
  // Meter this generation exactly like /api/generate-site so onboarding can't
  // be spammed for unlimited free Gemini calls. Free plan allows 1/month, so
  // the expected first onboarding generation is still permitted.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: generationsThisMonth } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('action', 'ai_generation')
    .gte('created_at', monthStart.toISOString())

  const usageCheck = checkMeteredFeature(
    plan,
    'ai_generation',
    generationsThisMonth ?? 0,
  )

  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error: usageCheck.reason,
        currentPlan: usageCheck.currentPlan,
        requiredPlan: usageCheck.requiredPlan,
        upgradeUrl: usageCheck.upgradeUrl,
        currentUsage: usageCheck.currentUsage,
        limit: usageCheck.limit,
      },
      { status: 403 },
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

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `AI generation failed: ${message}` },
      { status: 500 },
    )
  }

  // Extract FAQs from siteData for separate database storage
  const { faqs: generatedFaqs, ...cleanSiteData } = siteData

  // Persist with the service-role client (ownership verified above via the
  // user_id lookup) so completing onboarding doesn't depend on the artists
  // UPDATE RLS policy being present — otherwise onboarding_complete never flips
  // true and the public page / bookings never activate.
  const db = createSupabaseAdminClient()

  // Persist site data and mark onboarding complete
  const { error: updateError } = await db
    .from('artists')
    .update({
      site_data: cleanSiteData,
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

  // Sync FAQs if generated, wrapping in try-catch to handle missing table gracefully
  if (generatedFaqs && Array.isArray(generatedFaqs)) {
    try {
      await db.from('artist_faqs').delete().eq('artist_id', artist.id)
      if (generatedFaqs.length > 0) {
        const { error: faqError } = await db.from('artist_faqs').insert(
          generatedFaqs.map((f, i) => ({
            artist_id: artist.id,
            question: f.question,
            answer: f.answer,
            display_order: i,
          })),
        )
        if (faqError) {
          console.error('[onboarding/generate-site] Failed to save generated FAQs:', faqError.message)
        }
      }
    } catch (err) {
      console.warn(
        '[onboarding/generate-site] Gracefully caught FAQ sync error (table may not exist yet):',
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Log the generation to audit_logs for metered tracking (same as
  // /api/generate-site) so repeated onboarding calls count against the plan.
  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'ai_generation',
    resource_type: 'artist',
    resource_id: artist.id,
    metadata: {
      plan,
      generationNumber: (generationsThisMonth ?? 0) + 1,
      source: 'onboarding',
    },
  })

  return NextResponse.json({ ok: true, siteData })
}
