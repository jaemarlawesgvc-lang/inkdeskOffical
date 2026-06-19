import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { StatsRow } from '@/components/dashboard/StatsRow'
import { UpcomingBookings } from '@/components/dashboard/UpcomingBookings'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

function startOfTodayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function startOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardOverviewPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select('id, onboarding_complete, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!artist) redirect('/onboarding')
  if (!artist.onboarding_complete) redirect('/onboarding')

  const todayIso = startOfTodayIso()
  const weekEndIso = addDaysIso(7)
  const monthStartIso = startOfMonthIso()

  const [
    { count: totalBookings },
    { data: monthDeposits },
    { data: upcomingRows },
    { count: clientsTotal },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist.id)
      .is('deleted_at', null),
    supabase
      .from('bookings')
      .select('deposit_amount')
      .eq('artist_id', artist.id)
      .eq('deposit_paid', true)
      .is('deleted_at', null)
      .gte('booking_date', monthStartIso),
    supabase
      .from('bookings')
      .select(
        'id, client_name, booking_date, booking_time, status, deposit_paid',
      )
      .eq('artist_id', artist.id)
      .is('deleted_at', null)
      .in('status', ['pending', 'confirmed', 'deposit_paid'])
      .gte('booking_date', todayIso)
      .lte('booking_date', weekEndIso)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true })
      .limit(10),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist.id),
  ])

  const revenue = (monthDeposits ?? []).reduce(
    (sum, row) => sum + Number(row.deposit_amount ?? 0),
    0,
  )

  const upcomingBookings = (upcomingRows ?? []).map((b) => ({
    id: b.id,
    clientName: b.client_name,
    bookingDate: b.booking_date,
    bookingTime: b.booking_time,
    status: b.status,
    depositPaid: b.deposit_paid,
  }))

  const stats = [
    {
      label: 'Total bookings',
      value: String(totalBookings ?? 0),
      accent: 'sky' as const,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Revenue this month',
      value: `£${revenue.toFixed(2)}`,
      subtext: 'Deposits collected',
      accent: 'gold' as const,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v2.718a2.49 2.49 0 01-.83-.355c-.281-.195-.42-.41-.45-.567a1 1 0 11-1.96.39c.16.82.78 1.39 1.45 1.74.39.2.83.34 1.29.4V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V6.374c.32.085.61.222.84.39.282.197.42.412.45.57a1 1 0 101.96-.392c-.16-.819-.78-1.39-1.45-1.74A3.984 3.984 0 0011 4.092V4a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Upcoming this week',
      value: String(upcomingBookings.length),
      accent: 'violet' as const,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Clients total',
      value: String(clientsTotal ?? 0),
      accent: 'emerald' as const,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
  ]

  const firstName = (artist.display_name ?? '').trim().split(' ')[0] ?? ''
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold-500">
            {dateLabel}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-white">
            {timeGreeting()}
            {firstName && (
              <>
                , <span className="text-gold-300">{firstName}</span>
              </>
            )}
          </h1>
        </div>
        <Link
          href="/dashboard/bookings"
          className={buttonVariants({ variant: 'primary', size: 'md', className: 'gap-1.5' })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          New booking
        </Link>
      </div>

      <StatsRow stats={stats} />

      {/* Upcoming */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Upcoming bookings</h2>
          <span className="text-xs font-medium uppercase tracking-widest text-white/35">Next 7 days</span>
        </div>
        <UpcomingBookings bookings={upcomingBookings} />
      </section>
    </div>
  )
}
