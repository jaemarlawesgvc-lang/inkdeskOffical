import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AftercareGuideDocument } from '@/lib/pdf/AftercareGuideDocument'
import { redis } from '@/lib/redis/client'
import { Ratelimit } from '@upstash/ratelimit'
import { z } from 'zod'

export const runtime = 'nodejs'

// This endpoint is unauthenticated and renders a heavy PDF, so cap it per
// artist+IP to prevent it being used as a CPU/cost amplifier.
const aftercareRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/aftercare-guide',
})

const querySchema = z.object({
  artist_id: z.string().uuid(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse({
    artist_id: request.nextUrl.searchParams.get('artist_id') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid artist_id is required' }, { status: 400 })
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Per-artist/IP rate limit. Fails open if Upstash is unreachable.
  try {
    const { success } = await aftercareRateLimit.limit(
      `${parsed.data.artist_id}:${ipAddress}`,
    )
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429 },
      )
    }
  } catch (err) {
    console.warn('[api/aftercare-guide] rate limit check failed (failing open):', err)
  }

  const supabase = createSupabaseAdminClient()

  const { data: artist, error } = await supabase
    .from('artists')
    .select('display_name, username, studio_name, onboarding_complete')
    .eq('id', parsed.data.artist_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const artistName = artist.display_name ?? artist.username

  // Do NOT embed the artist's login email (profile.email) in a publicly
  // downloadable PDF. The artists table has no dedicated public contact-email
  // column, so we fall back to the generic support address rather than leaking
  // a personal login address to anyone who fetches the guide.
  const buffer = await renderToBuffer(
    AftercareGuideDocument({
      artistName,
      studioName: artist.studio_name,
      contactEmail: 'support@inkdesk.live',
    }),
  )

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="aftercare-guide-${artist.username}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
