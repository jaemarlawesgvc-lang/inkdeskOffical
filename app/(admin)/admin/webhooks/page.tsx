import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WebhooksTable } from '@/components/admin/WebhooksTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Webhooks' }

export default async function AdminWebhooksPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch recent stripe events (most recent 200)
  const { data: events } = await supabase
    .from('stripe_events')
    .select('id, stripe_event_id, event_type, processed, processed_at, error, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(200)

  const mappedEvents = (events ?? []).map((e) => ({
    id: e.id,
    stripeEventId: e.stripe_event_id,
    eventType: e.event_type,
    processed: e.processed ?? false,
    processedAt: e.processed_at,
    error: e.error,
    createdAt: e.created_at,
    payload: (e.payload ?? {}) as Record<string, unknown>,
  }))

  const failedCount = mappedEvents.filter((e) => !e.processed && e.error).length

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhook Inspector</h1>
          <p className="text-white/40 text-sm mt-0.5">
            View and manage Stripe webhook events
          </p>
        </div>
        {failedCount > 0 && (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-crimson-500/20 text-crimson-400">
            {failedCount} failed
          </span>
        )}
      </div>

      <WebhooksTable initialEvents={mappedEvents} />
    </div>
  )
}
