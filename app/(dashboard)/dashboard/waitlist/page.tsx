import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WaitlistTable } from '@/components/dashboard/WaitlistTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Waitlist' }

export default async function WaitlistPage() {
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

  const { data: entries } = await supabase
    .from('waitlist')
    .select('id, client_name, client_email, preferred_styles, flexible_on_date, preferred_date_from, preferred_date_to, notified_at, created_at')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })

  const mapped = (entries ?? []).map((e) => ({
    id: e.id,
    clientName: e.client_name,
    clientEmail: e.client_email,
    preferredStyles: e.preferred_styles ?? [],
    flexibleOnDate: e.flexible_on_date,
    preferredDateFrom: e.preferred_date_from,
    preferredDateTo: e.preferred_date_to,
    notifiedAt: e.notified_at,
    createdAt: e.created_at,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Waitlist</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Clients who asked to be notified when a slot opens up. {mapped.length} total.
        </p>
      </div>
      <WaitlistTable entries={mapped} />
    </div>
  )
}
