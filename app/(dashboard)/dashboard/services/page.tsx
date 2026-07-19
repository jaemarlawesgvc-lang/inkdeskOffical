import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ServicesManager } from '@/components/dashboard/ServicesManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Services' }

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!artist) redirect('/onboarding')

  // Table may not exist yet on an older schema (pre-022) — degrade gracefully.
  let services: {
    id: string
    name: string
    durationMinutes: number
    pricePence: number | null
    active: boolean
    sortOrder: number
  }[] = []
  try {
    const { data: rows } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price_pence, active, sort_order')
      .eq('artist_id', artist.id as string)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    services = (rows ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      durationMinutes: r.duration_minutes as number,
      pricePence: (r.price_pence as number | null) ?? null,
      active: r.active as boolean,
      sortOrder: r.sort_order as number,
    }))
  } catch {
    console.warn('[services] query failed — table may not exist yet')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Services</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Define what you offer and how long each takes. Booking slot lengths adjust to the service a
          client picks.
        </p>
      </div>

      <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 max-w-2xl">
        <ServicesManager initialServices={services} />
      </section>
    </div>
  )
}
