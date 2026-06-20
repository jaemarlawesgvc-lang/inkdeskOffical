import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ConsentFormDocument } from '@/lib/pdf/ConsentFormDocument'
import { z } from 'zod'

export const runtime = 'nodejs'

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

  const supabase = createSupabaseAdminClient()

  const { data: artist, error } = await supabase
    .from('artists')
    .select('display_name, username, studio_name, onboarding_complete, profiles ( email )')
    .eq('id', parsed.data.artist_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const profile = artist.profiles as unknown as { email: string } | null
  const artistName = artist.display_name ?? artist.username

  const buffer = await renderToBuffer(
    ConsentFormDocument({
      artistName,
      studioName: artist.studio_name,
      contactEmail: profile?.email ?? 'support@inkdesk.live',
    }),
  )

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="consent-form-${artist.username}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
