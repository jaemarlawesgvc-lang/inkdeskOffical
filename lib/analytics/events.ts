import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Analytics event emit helper
//
// Records rows into the (previously dormant) analytics_events table that powers
// the business-intelligence dashboard. Uses the service-role admin client so it
// works from public/anonymous contexts (e.g. a visitor viewing a page or
// starting a booking) where there is no artist session.
//
// Fire-and-forget: emitting analytics must NEVER block or fail the primary
// action (page render, booking submit). All errors are swallowed and logged.
// ---------------------------------------------------------------------------

export type AnalyticsEventType =
  | 'page_view'
  | 'booking_started'
  | 'booking_completed'

/**
 * Log a single analytics event for an artist. Safe to call without awaiting.
 *
 * @example
 *   void logAnalyticsEvent(artistId, 'page_view', { path: '/username' })
 */
export async function logAnalyticsEvent(
  artistId: string,
  eventType: AnalyticsEventType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!artistId) return
  try {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('analytics_events').insert({
      artist_id: artistId,
      event_type: eventType,
      metadata: metadata ?? null,
    })
    if (error) {
      console.warn('[analytics] emit failed:', error.message)
    }
  } catch (err) {
    console.warn('[analytics] emit threw:', err)
  }
}
