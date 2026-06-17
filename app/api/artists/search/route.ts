import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = searchParams.get('q')?.toLowerCase() ?? ''
    const style = searchParams.get('style') ?? ''
    const priceTier = searchParams.get('priceTier') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const supabase = createSupabaseAdminClient()

    let dbQuery = supabase
      .from('artists')
      .select(
        `
        id,
        username,
        display_name,
        is_verified,
        price_tier,
        bio,
        style_tags,
        studio_name,
        studio_address,
        deposit_required,
        deposit_amount,
        onboarding_complete,
        created_at,
        portfolio_images (
          public_url,
          caption,
          display_order
        )
      `,
        { count: 'exact' },
      )
      .eq('onboarding_complete', true)
      .is('deleted_at', null)

    // Text search on display_name, username, or bio
    if (query) {
      dbQuery = dbQuery.or(
        `display_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`,
      )
    }

    // Filter by style tag
    if (style) {
      dbQuery = dbQuery.contains('style_tags', [style])
    }

    // Filter by price tier
    if (priceTier) {
      dbQuery = dbQuery.eq('price_tier', priceTier)
    }

    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    let { data: artists, error, count } = await dbQuery

    // Graceful fallback for missing columns if migration has not been pushed yet
    if (error && (error.code === '42703' || error.message.includes('price_tier') || error.message.includes('is_verified'))) {
      let fallbackQuery = supabase
        .from('artists')
        .select(
          `
          id,
          username,
          display_name,
          bio,
          style_tags,
          studio_name,
          studio_address,
          deposit_required,
          deposit_amount,
          onboarding_complete,
          created_at,
          portfolio_images (
            public_url,
            caption,
            display_order
          )
        `,
          { count: 'exact' },
        )
        .eq('onboarding_complete', true)
        .is('deleted_at', null)

      if (query) {
        fallbackQuery = fallbackQuery.or(
          `display_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`,
        )
      }

      if (style) {
        fallbackQuery = fallbackQuery.contains('style_tags', [style])
      }

      fallbackQuery = fallbackQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const fallbackRes = await fallbackQuery
      artists = fallbackRes.data as any
      error = fallbackRes.error
      count = fallbackRes.count
    }

    if (error) {
      console.error('[artists/search] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch review aggregates for each artist
    const artistIds = (artists ?? []).map((a) => a.id)
    let reviewAggregates: Record<string, { avg: number; count: number }> = {}

    if (artistIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('artist_id, rating')
        .in('artist_id', artistIds)
        .eq('approved', true)
        .eq('flagged', false)
        .not('rating', 'is', null)

      if (reviews) {
        const grouped: Record<string, number[]> = {}
        for (const r of reviews) {
          const list = grouped[r.artist_id] ?? []
          if (r.rating !== null && r.rating !== undefined) {
            list.push(r.rating)
            grouped[r.artist_id] = list
          }
        }
        for (const [id, ratings] of Object.entries(grouped)) {
          if (ratings && ratings.length > 0) {
            const sum = ratings.reduce((a, b) => a + b, 0)
            reviewAggregates[id] = {
              avg: Math.round((sum / ratings.length) * 10) / 10,
              count: ratings.length,
            }
          }
        }
      }
    }

    const result = (artists ?? []).map((artist) => {
      const portfolio = (
        (artist.portfolio_images as {
          public_url: string
          caption: string | null
          display_order: number
        }[]) ?? []
      )
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .slice(0, 4)
        .map((img) => img.public_url)

      const reviews = reviewAggregates[artist.id] ?? { avg: 0, count: 0 }

      return {
        id: artist.id,
        username: artist.username,
        displayName: artist.display_name ?? artist.username,
        bio: artist.bio,
        styleTags: (artist.style_tags as string[]) ?? [],
        studioName: artist.studio_name,
        studioAddress: artist.studio_address,
        depositRequired: artist.deposit_required,
        depositAmount: artist.deposit_amount,
        portfolioImages: portfolio,
        rating: reviews.avg,
        reviewCount: reviews.count,
        isVerified: (artist as any).is_verified ?? false,
        priceTier: (artist as any).price_tier ?? '££',
      }
    })

    return NextResponse.json({
      artists: result,
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[artists/search] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
