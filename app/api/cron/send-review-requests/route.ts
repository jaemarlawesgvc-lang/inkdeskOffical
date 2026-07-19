import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendReviewRequest } from '@/lib/resend/send'

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

  // Fire on bookings COMPLETED within the last ~25h, not on booking_date.
  // There is no completed_at column; a booking is marked 'completed' via an
  // UPDATE, which bumps updated_at (set_bookings_updated_at trigger), so
  // updated_at is the most correct "recently completed" signal available. This
  // catches bookings completed on a day other than their scheduled date. The
  // reviews-row check + email_logs idempotency keep re-runs safe.
  const completedSince = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      artist_id,
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
    // Only real tattoo sessions get review requests — not video consultations.
    .eq('booking_type', 'live')
    .gte('updated_at', completedSince)
    .is('deleted_at', null)

  if (error) {
    console.error('[cron/send-review-requests] query error:', error.message)
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
      username: string
      profiles: { email: string } | null
    } | null
    if (!artist) {
      results.failed++
      results.errors.push(`Booking ${booking.id} has no artist`)
      continue
    }

    // Ensure a review row exists for this booking (one review slot per
    // booking, created up front with rating left null so the token can be
    // emailed and validated later when the client actually submits).
    const { data: existing } = await supabase
      .from('reviews')
      .select('token')
      .eq('booking_id', booking.id)
      .maybeSingle()

    let token: string

    if (existing) {
      token = existing.token
    } else {
      const { data: created, error: insertError } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          artist_id: booking.artist_id,
          client_name: booking.client_name,
        })
        .select('token')
        .single()

      if (insertError || !created) {
        results.failed++
        results.errors.push(`${booking.id}: ${insertError?.message ?? 'could not create review row'}`)
        continue
      }
      token = created.token
    }

    const result = await sendReviewRequest(supabase, {
      bookingId: booking.id,
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      artistName: artist.display_name ?? 'Your artist',
      reviewToken: token,
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

  console.info('[cron/send-review-requests] complete:', results)
  return NextResponse.json(results)
}
