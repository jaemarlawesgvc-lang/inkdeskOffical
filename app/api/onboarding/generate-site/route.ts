import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  callGemini,
  buildSitePrompt,
  type SiteData,
} from '@/lib/gemini/client'
import { resolveActivePlan, checkMeteredFeature } from '@/lib/stripe/plans'

// Re-export SiteData so Step5GenerateSite.tsx import remains valid
export type { SiteData }

/**
 * Build a valid starter site from the artist's own onboarding data. Used when
 * the AI generation fails or isn't configured, so completing onboarding — and
 * therefore publishing the public page — is NEVER hard-blocked on a third-party
 * AI call. The artist can refine everything later in the dashboard.
 */
function buildFallbackSiteData(params: {
  displayName: string
  bio: string
  styleTags: string[]
}): SiteData {
  const name = params.displayName.trim() || 'My Studio'
  const styles = params.styleTags.length ? params.styleTags.join(', ') : 'custom tattoos'
  const body =
    params.bio.trim() ||
    `Hi, I'm ${name}. I specialise in ${styles}. Get in touch to book a consultation and bring your idea to life.`

  return {
    hero: {
      headline: name,
      subheadline: params.styleTags.length ? `${styles} tattoos` : 'Custom tattoos & consultations',
      ctaText: 'Book a consultation',
    },
    about: {
      title: 'About',
      body: body.slice(0, 800),
    },
    services: [
      {
        name: 'Consultation',
        description: 'A relaxed chat to plan your piece, placement, and pricing.',
        priceFrom: 'Free',
      },
      {
        name: 'Custom tattoo',
        description: 'A bespoke design created for you, booked with a deposit.',
        priceFrom: 'On request',
      },
    ],
    seoTitle: `${name} — Tattoo Artist`.slice(0, 70),
    seoDescription: `Book a consultation with ${name}. ${styles}.`.slice(0, 160),
    colorScheme: { primary: '#080808', secondary: '#1a1a1a', accent: '#ffb700' },
  }
}

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

  // Over the monthly AI limit? Do NOT block onboarding — completing it publishes
  // the artist's page, which must never be gated behind an AI quota. Instead we
  // skip the Gemini call and publish a starter site (below). The quota still caps
  // real AI generations; the artist can regenerate with AI next month or on a
  // paid plan.
  const aiAllowed = usageCheck.allowed

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

  const fallbackSite = () =>
    buildFallbackSiteData({
      displayName: artist.display_name ?? 'Unknown Artist',
      bio: artist.bio ?? '',
      styleTags,
    })

  let siteData: SiteData
  let usedFallback = false
  if (!aiAllowed) {
    // Quota exhausted — publish a starter site rather than blocking completion.
    siteData = fallbackSite()
    usedFallback = true
  } else {
    try {
      siteData = await callGemini(prompt)
    } catch (err) {
      // AI generation is best-effort. Never strand an artist unpublished just
      // because Gemini timed out, returned junk, or isn't configured — fall back
      // to a starter site built from their own onboarding data and still complete
      // onboarding. They can refine it in the dashboard afterwards.
      console.error(
        '[onboarding/generate-site] Gemini failed, using fallback site:',
        err instanceof Error ? err.message : err,
      )
      siteData = fallbackSite()
      usedFallback = true
    }
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
  // Only count a real AI generation — a fallback consumed no Gemini quota.
  if (!usedFallback) {
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
  }

  return NextResponse.json({ ok: true, siteData, usedFallback })
}
