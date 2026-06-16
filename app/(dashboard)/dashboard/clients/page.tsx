import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientsList } from '@/components/dashboard/ClientsList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) redirect('/onboarding')

  const { data: clientRows } = await supabase
    .from('clients')
    .select(
      `
      id,
      name,
      email,
      phone,
      booking_count,
      last_booking_at,
      notes,
      bookings (
        id,
        booking_date,
        booking_time,
        status
      )
    `,
    )
    .eq('artist_id', artist.id)
    .order('last_booking_at', { ascending: false })
    .limit(200)

  const clients = (clientRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    booking_count: c.booking_count ?? 0,
    last_booking_at: c.last_booking_at,
    notes: c.notes,
    bookings: (
      (c.bookings as { id: string; booking_date: string; booking_time: string | null; status: string }[]) ?? []
    )
      .sort((a, b) => b.booking_date.localeCompare(a.booking_date))
      .slice(0, 10),
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-white/40 text-sm mt-0.5">{clients.length} total</p>
      </div>
      <ClientsList clients={clients} />
    </div>
  )
}
