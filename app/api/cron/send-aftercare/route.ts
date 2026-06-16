import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendAftercare, loadBookingWithArtist } from '@/lib/resend/send'

export const runtime = 'nodejs'

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

  // Yesterday's date in UTC — bookings on that date are considered completed
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayDate = yesterday.toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['confirmed', 'deposit_paid'])
    .eq('booking_date', yesterdayDate)
    .is('deleted_at', null)

  if (error) {
    console.error('[cron/send-aftercare] query error:', error.message)
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

    const result = await sendAftercare(supabase, booking)

    if (result.skipped) {
      results.skipped++
    } else if (result.success) {
      results.sent++
    } else {
      results.failed++
      if (result.error) results.errors.push(`${row.id}: ${result.error}`)
    }
  }

  console.info('[cron/send-aftercare] complete:', results)
  return NextResponse.json(results)
}
