import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCancellationOpening } from '@/lib/resend/send'

const MAX_NOTIFICATIONS = 5

/**
 * Called when a booking is cancelled. Notifies up to MAX_NOTIFICATIONS people
 * who EXPLICITLY joined the artist's waitlist and haven't been notified yet.
 *
 * We deliberately do NOT email clients who merely have a pending booking near
 * the cancelled date — they never opted in to "an opening appeared" alerts, so
 * messaging them is surprising and can cause double-bookings. Only opted-in
 * waitlist members are notified.
 *
 * Best-effort — failures are logged but never thrown, so a notification
 * problem can't block the cancellation itself.
 */
export async function notifyCancellationOpening(
  supabase: SupabaseClient,
  params: {
    artistId: string
    artistName: string
    artistUsername: string
    cancelledDate: string
    artistEmail: string | null
  },
): Promise<void> {
  try {
    const { artistId, artistName, artistUsername, cancelledDate, artistEmail } = params

    const { data: waitlistEntries } = await supabase
      .from('waitlist')
      .select('id, client_name, client_email')
      .eq('artist_id', artistId)
      .is('notified_at', null)
      .limit(MAX_NOTIFICATIONS)

    for (const entry of waitlistEntries ?? []) {
      const result = await sendCancellationOpening(supabase, {
        bookingId: null,
        clientName: entry.client_name,
        clientEmail: entry.client_email,
        artistName,
        artistUsername,
        openingDate: cancelledDate,
        artistEmail,
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
