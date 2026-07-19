import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveStudioMembership, getStudioMemberArtistIds } from '@/lib/studio/access'

// Service-role admin client + explicit membership check; Node runtime.
export const runtime = 'nodejs'

interface StudioBookingDTO {
  id: string
  artistId: string
  artistName: string
  clientName: string
  bookingDate: string
  bookingTime: string
  durationHours: number
  status: string
}

// ── GET: aggregated upcoming bookings across all member artists ───────────────
// This is the shared studio calendar feed. Read-only.
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const membership = await resolveStudioMembership(user.id)
  if (!membership) {
    return NextResponse.json({ error: 'No studio found for this account.' }, { status: 404 })
  }

  const artistIds = await getStudioMemberArtistIds(membership.studioId)
  if (artistIds.length === 0) {
    return NextResponse.json({ bookings: [] })
  }

  const admin = createSupabaseAdminClient()

  // Names for the artists in scope.
  const nameById = new Map<string, string>()
  const { data: artists } = await admin
    .from('artists')
    .select('id, display_name, username')
    .in('id', artistIds)
  for (const a of artists ?? []) {
    nameById.set(a.id as string, (a.display_name as string | null) ?? (a.username as string))
  }

  // Upcoming, non-deleted, occupying-status bookings for those artists.
  const today = new Date().toISOString().slice(0, 10)
  const { data: bookings } = await admin
    .from('bookings')
    .select('id, artist_id, client_name, booking_date, booking_time, duration_hours, status')
    .in('artist_id', artistIds)
    .is('deleted_at', null)
    .gte('booking_date', today)
    .in('status', ['pending', 'confirmed', 'deposit_paid'])
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true })
    .limit(500)

  const dto: StudioBookingDTO[] = (bookings ?? []).map((b) => ({
    id: b.id as string,
    artistId: b.artist_id as string,
    artistName: nameById.get(b.artist_id as string) ?? 'Artist',
    clientName: b.client_name as string,
    bookingDate: b.booking_date as string,
    bookingTime: (b.booking_time as string).slice(0, 5),
    durationHours: Number(b.duration_hours),
    status: b.status as string,
  }))

  return NextResponse.json({ bookings: dto })
}
