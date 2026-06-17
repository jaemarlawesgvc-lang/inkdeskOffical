import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendReminder48h, sendReminder7day, loadBookingWithArtist } from '@/lib/resend/send'
import type { SendResult } from '@/lib/resend/client'

export const runtime = 'nodejs'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

interface WindowResults {
  processed: number
  sent: number
  skipped: number
  failed: number
  errors: string[]
}

function emptyResults(): WindowResults {
  return { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] }
}

// Vercel calls cron routes with GET; we also accept POST for manual triggering.
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function processWindow(
  supabase: AdminClient,
  startDate: string,
  endDate: string,
  send: (supabase: AdminClient, booking: NonNullable<Awaited<ReturnType<typeof loadBookingWithArtist>>>) => Promise<SendResult>,
  label: string,
): Promise<WindowResults> {
  const results = emptyResults()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['confirmed', 'deposit_paid'])
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .is('deleted_at', null)

  if (error) {
    console.error(`[cron/send-reminders] ${label} query error:`, error.message)
    results.errors.push(`query error: ${error.message}`)
    return results
  }

  for (const row of bookings ?? []) {
    results.processed++

    const booking = await loadBookingWithArtist(supabase, row.id)
    if (!booking) {
      results.failed++
      results.errors.push(`Could not load booking ${row.id}`)
      continue
    }

    const result = await send(supabase, booking)

    if (result.skipped) {
      results.skipped++
    } else if (result.success) {
      results.sent++
    } else {
      results.failed++
      if (result.error) results.errors.push(`${row.id}: ${result.error}`)
    }
  }

  return results
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()
  const now = new Date()

  // 48-hour window — within a 1h tolerance for cron timing drift
  // (email_logs idempotency prevents duplicate sends across retries).
  const window48hStart = new Date(now.getTime() + 47 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const window48hEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 7-day window — within a ±12h tolerance.
  const window7dStart = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const window7dEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [reminder48h, reminder7day] = await Promise.all([
    processWindow(supabase, window48hStart, window48hEnd, sendReminder48h, '48h'),
    processWindow(supabase, window7dStart, window7dEnd, sendReminder7day, '7day'),
  ])

  console.info('[cron/send-reminders] complete:', { reminder48h, reminder7day })
  return NextResponse.json({ reminder48h, reminder7day })
}
