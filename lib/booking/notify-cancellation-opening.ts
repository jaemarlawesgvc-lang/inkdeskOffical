import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCancellationOpening } from '@/lib/resend/send'

const MAX_NOTIFICATIONS = 5
const WINDOW_DAYS = 3

/**
 * Called when a booking is cancelled. Notifies up to MAX_NOTIFICATIONS
 * clients who might want the freed-up slot:
 *   1. Clients with a still-`pending` booking within ±WINDOW_DAYS of the
 *      cancelled date (they asked for a nearby date and haven't been
 *      confirmed yet).
 *   2. Waitlist entries for the same artist that haven't been notified yet.
 *
 * Best-effort — failures are logged but never thrown, so a notification
 * problem can't block the cancellation itself.
 */
export async function notifyCancellationOpening(
  supabase: SupabaseClient,
  params: { artistId: string; artistName: string; artistUsername: string; cancelledDate: string },
): Promise<void> {
  try {
    const { artistId, artistName, artistUsername, cancelledDate } = params

    const windowStart = addDays(cancelledDate, -WINDOW_DAYS)
    const windowEnd = addDays(cancelledDate, WINDOW_DAYS)

    const { data: pendingBookings } = await supabase
      .from('bookings')
      .select('id, client_name, client_email')
      .eq('artist_id', artistId)
      .eq('status', 'pending')
      .gte('booking_date', windowStart)
      .lte('booking_date', windowEnd)
      .is('deleted_at', null)
      .limit(MAX_NOTIFICATIONS)

    const remaining = MAX_NOTIFICATIONS - (pendingBookings?.length ?? 0)
    let waitlistEntries: { id: string; client_name: string; client_email: string }[] = []

    if (remaining > 0) {
      const { data } = await supabase
        .from('waitlist')
        .select('id, client_name, client_email')
        .eq('artist_id', artistId)
        .is('notified_at', null)
        .limit(remaining)
      waitlistEntries = data ?? []
    }

    for (const booking of pendingBookings ?? []) {
      await sendCancellationOpening(supabase, {
        bookingId: booking.id,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        artistName,
        artistUsername,
        openingDate: cancelledDate,
      })
    }

    for (const entry of waitlistEntries) {
      const result = await sendCancellationOpening(supabase, {
        bookingId: null,
        clientName: entry.client_name,
        clientEmail: entry.client_email,
        artistName,
        artistUsername,
        openingDate: cancelledDate,
      })
      if (result.success) {
        await supabase
          .from('waitlist')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', entry.id)
      }
    }
  } catch (err) {
    console.error(
      '[notifyCancellationOpening] failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
