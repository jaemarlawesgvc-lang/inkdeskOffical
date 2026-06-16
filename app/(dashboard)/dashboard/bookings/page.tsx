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

  const { data: bookings } = await supabase
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
      reference_images,
      stripe_payment_status,
      created_at
    `,
    )
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/40 text-sm mt-0.5">{bookings?.length ?? 0} total</p>
      </div>
      <BookingsTable
        bookings={bookings ?? []}
        artistId={artist.id}
        plan={plan}
      />
    </div>
  )
}
