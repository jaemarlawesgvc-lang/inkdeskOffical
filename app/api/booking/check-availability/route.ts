import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { checkAvailabilitySchema } from '@/lib/validations/booking'
import { isSlotAvailable } from '@/lib/booking/availability'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl

  const parsed = checkAvailabilitySchema.safeParse({
    artistId: searchParams.get('artistId') ?? '',
    date: searchParams.get('date') ?? '',
    time: searchParams.get('time') || undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { available: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseAdminClient()

  // Verify artist exists and is publicly bookable
  const { data: artist } = await supabase
    .from('artists')
    .select('id, onboarding_complete')
    .eq('id', parsed.data.artistId)
    .is('deleted_at', null)
    .single()

  if (!artist || !artist.onboarding_complete) {
    return NextResponse.json(
      { available: false, error: 'Artist not found' },
      { status: 404 },
    )
  }

  const result = await isSlotAvailable(
    supabase,
    parsed.data.artistId,
    parsed.data.date,
    parsed.data.time,
  )

  return NextResponse.json(result)
}
