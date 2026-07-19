import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AvailabilityManager } from '@/components/dashboard/AvailabilityManager'
import { getAppUrl } from '@/lib/app-url'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Availability' }

export default async function AvailabilityPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // select('*') so the query never fails if buffer_minutes / calendar_feed_token
  // are missing on an older schema (pre-022).
  const { data: artist } = await supabase
    .from('artists')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!artist) redirect('/onboarding')

  const { data: rows } = await supabase
    .from('artist_availability')
    .select('day_of_week, start_time, end_time')
    .eq('artist_id', artist.id as string)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  const windows = (rows ?? []).map((r) => ({
    dayOfWeek: r.day_of_week as number,
    startTime: (r.start_time as string).slice(0, 5),
    endTime: (r.end_time as string).slice(0, 5),
  }))

  const bufferMinutes = (artist.buffer_minutes as number | undefined) ?? 0
  const feedToken = artist.calendar_feed_token as string | undefined
  const feedUrl = feedToken ? `${getAppUrl()}/api/calendar/${feedToken}` : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Availability</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Set your bookable hours, add setup time between appointments, and sync bookings to your
          calendar.
        </p>
      </div>

      <AvailabilityManager
        initialWindows={windows}
        initialBufferMinutes={bufferMinutes}
        feedUrl={feedUrl}
      />
    </div>
  )
}
