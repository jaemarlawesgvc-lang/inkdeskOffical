import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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
    .select('id, display_name, username, studio_name, onboarding_complete')
    .eq('id', parsed.data.artist_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  return NextResponse.json({
    artistId: artist.id,
    artistName: artist.display_name ?? artist.username,
    studioName: artist.studio_name,
  })
}
