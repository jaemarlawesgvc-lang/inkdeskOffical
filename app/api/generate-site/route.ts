import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  callGemini,
  buildSitePrompt,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
} from '@/lib/gemini/client'
import { resolveActivePlan, checkMeteredFeature } from '@/lib/stripe/plans'

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const generateSiteSchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
})

export type GenerateSiteInput = z.infer<typeof generateSiteSchema>

// ---------------------------------------------------------------------------
// POST /api/generate-site
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  // ── Auth ──
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // ── Parse input ──
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = generateSiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  // ── Load artist (must belong to authed user) ──
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select(
      'id, user_id, display_name, bio, style_tags, portfolio_images(public_url)',
    )
    .eq('id', parsed.data.artistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  // ── Plan enforcement ──
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  // Count AI generations this month via audit_logs
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

  // ── Build prompt ──
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

  // ── Call Gemini ──
  try {
    const siteData = await callGemini(prompt)

    // Extract FAQs from siteData for separate database storage
    const { faqs: generatedFaqs, ...cleanSiteData } = siteData as any

    // Persist site data
    const { error: updateError } = await supabase
      .from('artists')
      .update({
        site_data: cleanSiteData,
        site_generated: true,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artist.id)

    if (updateError) {
      console.error('[generate-site] DB update error:', updateError.message)
      return NextResponse.json(
        { error: 'Generated successfully but failed to save. Please try again.' },
        { status: 500 },
      )
    }

    // Sync FAQs if generated, wrapping in try-catch to handle missing table gracefully
    if (generatedFaqs && Array.isArray(generatedFaqs)) {
      try {
        await supabase.from('artist_faqs').delete().eq('artist_id', artist.id)
        if (generatedFaqs.length > 0) {
          const { error: faqError } = await supabase.from('artist_faqs').insert(
            generatedFaqs.map((f: any, i: number) => ({
              artist_id: artist.id,
              question: f.question,
              answer: f.answer,
              display_order: i,
            })),
          )
          if (faqError) {
            console.error('[generate-site] Failed to save generated FAQs:', faqError.message)
          }
        }
      } catch (err: any) {
        console.warn('[generate-site] Gracefully caught FAQ sync error (table may not exist yet):', err.message || err)
      }
    }

    // Log generation to audit_logs for metered tracking
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_generation',
      resource_type: 'artist',
      resource_id: artist.id,
      metadata: { plan, generationNumber: (generationsThisMonth ?? 0) + 1 },
    })

    return NextResponse.json({ ok: true, siteData })
  } catch (err) {
    if (err instanceof GeminiTimeoutError) {
      return NextResponse.json(
        { error: 'AI generation timed out. Please try again.' },
        { status: 504 },
      )
    }

    if (err instanceof GeminiInvalidResponseError) {
      console.error('[generate-site] Gemini invalid response:', err.message)
      return NextResponse.json(
        { error: 'AI generation returned an invalid response. Please try again.' },
        { status: 500 },
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate-site] unexpected error:', message)
    return NextResponse.json(
      { error: `AI generation failed: ${message}` },
      { status: 500 },
    )
  }
}
