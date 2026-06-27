import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookingsTable } from '@/components/dashboard/BookingsTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Bookings' }

export default async function BookingsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select('id, user_id')
    .eq('user_id', user.id)
    .single()

  if (!artist) redirect('/onboarding')

  // Load subscription for CSV export gate
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan =
    subscription?.status === 'active' || subscription?.status === 'trialing'
      ? (subscription.plan as 'free' | 'pro' | 'studio')
      : 'free'

  // Primary query uses only base-schema columns so the page works even on a
  // partially-migrated database. The column is `reference_image_paths` — the
  // old code selected `reference_images`, which doesn't exist, so the whole
  // query returned null and NO bookings showed up to manage.
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select(
      `
      id,
      client_name,
      client_email,
      client_phone,
      booking_date,
      booking_time,
      duration_hours,
      status,
      deposit_amount,
      deposit_paid,
      description,
      reference_image_paths,
      stripe_payment_status,
      created_at,
      booking_type,
      total_amount
    `,
    )
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false })
    .limit(200)

  const baseBookings = bookingsRaw ?? []
  const bookingIds = baseBookings.map((b) => b.id as string)

  // Optional enrichment — `completed_photo_url` and the `reviews` table only
  // exist after later migrations. Query them separately and fall back to null
  // if they're absent, so a missing column/table can't blank the whole page.
  const completedPhotos: Record<string, string | null> = {}
  const reviewsByBooking: Record<string, { id: string; rating: number | null; flagged: boolean }> = {}

  if (bookingIds.length > 0) {
    const { data: photoRows } = await supabase
      .from('bookings')
      .select('id, completed_photo_url')
      .in('id', bookingIds)
    for (const row of photoRows ?? []) {
      const r = row as { id: string; completed_photo_url?: string | null }
      completedPhotos[r.id] = r.completed_photo_url ?? null
    }

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('id, rating, flagged, booking_id')
      .in('booking_id', bookingIds)
    for (const row of reviewRows ?? []) {
      const r = row as { id: string; rating: number | null; flagged: boolean; booking_id: string }
      reviewsByBooking[r.booking_id] = { id: r.id, rating: r.rating, flagged: r.flagged }
    }
  }

  const normalizedBookings = baseBookings.map((b) => {
    const row = b as Record<string, unknown>
    const id = row.id as string
    return {
      id,
      client_name: row.client_name as string,
      client_email: row.client_email as string,
      client_phone: (row.client_phone as string | null) ?? null,
      booking_date: row.booking_date as string,
      booking_time: (row.booking_time as string | null) ?? null,
      duration_hours: (row.duration_hours as number | null) ?? null,
      status: row.status as string,
      deposit_amount: (row.deposit_amount as number | null) ?? null,
      deposit_paid: (row.deposit_paid as boolean) ?? false,
      description: (row.description as string | null) ?? null,
      reference_images: (row.reference_image_paths as string[] | null) ?? null,
      stripe_payment_status: (row.stripe_payment_status as string | null) ?? null,
      completed_photo_url: completedPhotos[id] ?? null,
      created_at: row.created_at as string,
      review: reviewsByBooking[id] ?? null,
      booking_type: (row.booking_type as string) ?? 'consultation',
      total_amount: (row.total_amount as number | null) ?? null,
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/40 text-sm mt-0.5">{normalizedBookings.length} total</p>
      </div>
      <BookingsTable
        bookings={normalizedBookings}
        artistId={artist.id}
        plan={plan}
      />
    </div>
  )
}
