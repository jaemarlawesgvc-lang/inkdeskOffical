import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendCancellationOpening } from '@/lib/resend/send'
import { z } from 'zod'

const schema = z.object({
  waitlistId: z.string().uuid(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  const { waitlistId } = parsed.data

  const { data: artist } = await supabase
    .from('artists')
    .select('id, username, display_name, profiles(email)')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: entry } = await supabase
    .from('waitlist')
    .select('id, client_name, client_email, preferred_date_from, preferred_date_to, notified_at')
    .eq('id', waitlistId)
    .eq('artist_id', artist.id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
  }

  const artistProfile = artist.profiles as unknown as { email: string } | null
  const openingDate = entry.preferred_date_from ?? new Date().toISOString().slice(0, 10)

  await sendCancellationOpening(supabase, {
    bookingId: null,
    clientName: entry.client_name,
    clientEmail: entry.client_email,
    artistName: artist.display_name ?? artist.username ?? 'Your artist',
    artistUsername: artist.username ?? '',
    openingDate,
    artistEmail: artistProfile?.email ?? null,
  })

  await supabase
    .from('waitlist')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', waitlistId)

  return NextResponse.json({ ok: true })
}
