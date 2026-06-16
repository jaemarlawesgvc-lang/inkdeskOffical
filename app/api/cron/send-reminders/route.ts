import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendReminder48h, loadBookingWithArtist } from '@/lib/resend/send'

export const runtime = 'nodejs'

// Vercel calls cron routes with GET; we also accept POST for manual triggering.
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()

  // Find bookings whose booking_date is exactly 48h from now (within a 1h window
  // to tolerate cron timing drift — idempotency in email_logs prevents duplicate sends)
  const now = new Date()
  const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000)

  const startDate = windowStart.toISOString().slice(0, 10)
  const endDate = windowEnd.toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['confirmed', 'deposit_paid'])
    .gte('booking_date', startDate)
    .lte('booking_date', endDate)
    .is('deleted_at', null)

  if (error) {
    console.error('[cron/send-reminders] query error:', error.message)
    return NextResponse.json({ error: 'Failed to query bookings' }, { status: 500 })
  }

  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const row of bookings ?? []) {
    results.processed++

    const booking = await loadBookingWithArtist(supabase, row.id)
    if (!booking) {
      results.failed++
      results.errors.push(`Could not load booking ${row.id}`)
      continue
    }

    const result = await sendReminder48h(supabase, booking)

    if (result.skipped) {
      results.skipped++
    } else if (result.success) {
      results.sent++
    } else {
      results.failed++
      if (result.error) results.errors.push(`${row.id}: ${result.error}`)
    }
  }

  console.info('[cron/send-reminders] complete:', results)
  return NextResponse.json(results)
}
