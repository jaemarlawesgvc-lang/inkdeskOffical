import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendHealedPhotoRequest } from '@/lib/resend/send'

export const runtime = 'nodejs'

// Vercel calls cron routes with GET; POST is accepted for manual triggering.
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

  // Target completed live tattoo sessions ~21 days on from the appointment.
  // A 21–28 day window (by booking_date) tolerates missed cron days; email_logs
  // idempotency on (booking_id, 'healed_photo_request') prevents duplicate sends.
  const now = Date.now()
  const windowEnd = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const windowStart = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      client_name,
      client_email,
      artists (
        display_name,
        username,
        profiles ( email )
      )
    `,
    )
    .eq('status', 'completed')
    // Only real tattoo sessions — not video consultations.
    .eq('booking_type', 'live')
    .gte('booking_date', windowStart)
    .lte('booking_date', windowEnd)
    .is('deleted_at', null)

  if (error) {
    console.error('[cron/healed-photo-request] query error:', error.message)
    return NextResponse.json({ error: 'Failed to query bookings' }, { status: 500 })
  }

  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const booking of bookings ?? []) {
    results.processed++

    const artist = booking.artists as unknown as {
      display_name: string | null
      username: string | null
      profiles: { email: string } | null
    } | null

    if (!artist || !artist.username) {
      results.failed++
      results.errors.push(`Booking ${booking.id} has no artist/username`)
      continue
    }

    const result = await sendHealedPhotoRequest(supabase, {
      bookingId: booking.id,
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      artistName: artist.display_name ?? 'Your artist',
      artistUsername: artist.username,
      artistEmail: artist.profiles?.email ?? null,
    })

    if (result.skipped) {
      results.skipped++
    } else if (result.success) {
      results.sent++
    } else {
      results.failed++
      if (result.error) results.errors.push(`${booking.id}: ${result.error}`)
    }
  }

  console.info('[cron/healed-photo-request] complete:', results)
  return NextResponse.json(results)
}
