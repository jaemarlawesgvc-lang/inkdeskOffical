import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveActivePlan, checkBooleanFeature } from '@/lib/stripe/plans'

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)
  const gate = checkBooleanFeature(plan, 'analytics')

  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, currentPlan: gate.currentPlan, requiredPlan: gate.requiredPlan, upgradeUrl: gate.upgradeUrl },
      { status: 403 },
    )
  }

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, booking_date, deposit_amount, deposit_paid, client_name, client_email, created_at')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .gte('booking_date', sixMonthsAgoStr)
    .order('booking_date', { ascending: true })

  const rows = bookings ?? []

  const monthlyRevenue: Record<string, number> = {}
  const monthlyBookings: Record<string, { total: number; confirmed: number; completed: number; noShow: number; cancelled: number }> = {}
  const clientSpend: Record<string, { name: string; total: number; count: number }> = {}

  for (const b of rows) {
    const month = b.booking_date.slice(0, 7)

    if (!monthlyRevenue[month]) monthlyRevenue[month] = 0
    if (b.deposit_paid && b.deposit_amount) {
      monthlyRevenue[month] += b.deposit_amount
    }

    if (!monthlyBookings[month]) {
      monthlyBookings[month] = { total: 0, confirmed: 0, completed: 0, noShow: 0, cancelled: 0 }
    }
    monthlyBookings[month].total++
    if (b.status === 'confirmed') monthlyBookings[month].confirmed++
    if (b.status === 'completed') monthlyBookings[month].completed++
    if (b.status === 'no_show') monthlyBookings[month].noShow++
    if (b.status === 'cancelled') monthlyBookings[month].cancelled++

    const key = b.client_email.toLowerCase()
    if (!clientSpend[key]) {
      clientSpend[key] = { name: b.client_name, total: 0, count: 0 }
    }
    if (b.deposit_paid && b.deposit_amount) {
      clientSpend[key].total += b.deposit_amount
    }
    clientSpend[key].count++
  }

  const revenueChart = Object.entries(monthlyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))

  const conversionChart = Object.entries(monthlyBookings)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => ({
      month,
      total: stats.total,
      confirmed: stats.confirmed + stats.completed,
      rate: stats.total > 0 ? Math.round(((stats.confirmed + stats.completed) / stats.total) * 100) : 0,
    }))

  const noShowChart = Object.entries(monthlyBookings)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => ({
      month,
      noShows: stats.noShow,
      rate: stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0,
    }))

  const totalRevenue = rows.filter(b => b.deposit_paid && b.deposit_amount).reduce((s, b) => s + (b.deposit_amount ?? 0), 0)
  const paidCount = rows.filter(b => b.deposit_paid && b.deposit_amount).length
  const avgValue = paidCount > 0 ? Math.round((totalRevenue / paidCount) * 100) / 100 : 0

  const topClients = Object.values(clientSpend)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(c => ({ name: c.name, total: Math.round(c.total * 100) / 100, bookings: c.count }))

  const thisMonth = now.toISOString().slice(0, 7)
  const upcomingThisMonth = rows.filter(
    b => b.booking_date.startsWith(thisMonth) && (b.status === 'confirmed' || b.status === 'pending'),
  ).length

  // ── Cancellation rate (overall, across the window) ──────────────────────────
  const cancelledCount = rows.filter(b => b.status === 'cancelled').length
  const cancellationRate = rows.length > 0 ? Math.round((cancelledCount / rows.length) * 100) : 0

  // ── Repeat-client rate (denormalised clients.booking_count) ─────────────────
  const { data: clientRows } = await supabase
    .from('clients')
    .select('booking_count')
    .eq('artist_id', artist.id)

  const totalClients = clientRows?.length ?? 0
  const repeatClients = (clientRows ?? []).filter(c => (c.booking_count ?? 0) >= 2).length
  const repeatClientRate = totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0

  // ── Booking funnel from analytics_events (page_view → started → completed) ──
  const sixMonthsAgoISO = sixMonthsAgo.toISOString()
  const { data: eventRows } = await supabase
    .from('analytics_events')
    .select('event_type')
    .eq('artist_id', artist.id)
    .gte('created_at', sixMonthsAgoISO)

  const funnel = { pageViews: 0, bookingStarted: 0, bookingCompleted: 0 }
  for (const e of eventRows ?? []) {
    if (e.event_type === 'page_view') funnel.pageViews++
    else if (e.event_type === 'booking_started') funnel.bookingStarted++
    else if (e.event_type === 'booking_completed') funnel.bookingCompleted++
  }
  // Fall back to booking rows for the "completed" leg if no events have been
  // emitted yet, so the funnel isn't empty before emit points are wired up.
  if (funnel.bookingCompleted === 0) {
    funnel.bookingCompleted = rows.filter(b => b.status === 'completed').length
  }

  // ── Top services (optional; the services table may be added by another agent) ─
  // Guarded so this endpoint never hard-depends on a table that might not exist.
  let topServices: { name: string; count: number }[] = []
  try {
    const { data: serviceRows, error: serviceError } = await supabase
      .from('services')
      .select('name, booking_count')
      .eq('artist_id', artist.id)
      .order('booking_count', { ascending: false })
      .limit(5)

    if (!serviceError && serviceRows) {
      topServices = serviceRows.map((s: { name: string; booking_count: number | null }) => ({
        name: s.name,
        count: s.booking_count ?? 0,
      }))
    }
  } catch {
    // services table absent — leave topServices empty.
    topServices = []
  }

  return NextResponse.json({
    revenueChart,
    conversionChart,
    noShowChart,
    avgValue,
    topClients,
    upcomingThisMonth,
    totalBookings: rows.length,
    cancellationRate,
    repeatClientRate,
    totalClients,
    funnel,
    topServices,
  })
}
