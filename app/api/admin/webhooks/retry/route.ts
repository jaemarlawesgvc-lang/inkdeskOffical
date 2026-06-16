import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { RetryWebhookSchema } from '@/lib/validations/admin'
import { processStripeEvent } from '@/lib/stripe/webhook-process'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Verify admin session ────────────────────────────────────────────────
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 2. Validate input ─────────────────────────────────────────────────────
  const body = await request.json()
  const parsed = RetryWebhookSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { eventId } = parsed.data

  // ── 3. Load the event from stripe_events ───────────────────────────────────
  const adminClient = createSupabaseAdminClient()

  const { data: eventRow, error: fetchError } = await adminClient
    .from('stripe_events')
    .select('id, stripe_event_id, event_type, payload, processed, error')
    .eq('id', eventId)
    .single()

  if (fetchError || !eventRow) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (eventRow.processed) {
    return NextResponse.json({ error: 'Event already processed' }, { status: 400 })
  }

  // ── 4. Re-process the event ────────────────────────────────────────────────
  try {
    const stripeEvent = eventRow.payload as unknown as Stripe.Event

    await processStripeEvent(adminClient, stripeEvent)

    // Mark as processed
    await adminClient
      .from('stripe_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq('id', eventId)

    // Log audit event
    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'webhook_retry',
      resource_type: 'stripe_event',
      resource_id: eventId,
      metadata: {
        stripe_event_id: eventRow.stripe_event_id,
        event_type: eventRow.event_type,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'

    // Update the error on the event
    await adminClient
      .from('stripe_events')
      .update({ error: `Retry failed: ${message}` })
      .eq('id', eventId)

    return NextResponse.json({ error: `Retry failed: ${message}` }, { status: 500 })
  }
}
