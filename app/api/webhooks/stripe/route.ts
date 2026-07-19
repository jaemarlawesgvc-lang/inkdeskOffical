import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { processStripeEvent } from '@/lib/stripe/webhook-process'

// ---------------------------------------------------------------------------
// Disable body parsing — Stripe requires the raw body for signature verification
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripe = getStripe()
  const supabase = createSupabaseAdminClient()

  // ── 1. Read raw body and verify signature ────────────────────────────────
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[stripe-webhook] signature error:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── 2. Check for duplicate event ─────────────────────────────────────────
  const { data: existingEvent } = await supabase
    .from('stripe_events')
    .select('id, processed')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existingEvent?.processed) {
    // Genuinely already processed — ack so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true })
  }

  // ── 3. Insert event before processing ────────────────────────────────────
  // If the event already exists but is NOT yet processed (a prior attempt
  // failed / was interrupted), skip the insert and fall through to re-process
  // it rather than silently dropping it.
  if (!existingEvent) {
    const eventRow = {
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
      processed_at: null,
      error: null,
    }

    const { error: insertError } = await supabase.from('stripe_events').insert(eventRow)

    if (insertError) {
      // Unique constraint race: another invocation beat us to the insert.
      if (insertError.code === '23505') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.error('[stripe-webhook] insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
    }
  }

  // ── 4. Process event ─────────────────────────────────────────────────────
  try {
    await processStripeEvent(supabase, event)

    // ── 5. Mark processed ──────────────────────────────────────────────────
    await supabase
      .from('stripe_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    // ── 6. Store error, do NOT mark processed ──────────────────────────────
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    console.error(`[stripe-webhook] ${event.type} processing error:`, message)

    await supabase
      .from('stripe_events')
      .update({ error: message })
      .eq('stripe_event_id', event.id)

    // Return a non-2xx so Stripe retries the delivery — the event row stays
    // processed=false and will be re-processed on the next attempt.
    return NextResponse.json({ received: false, error: message }, { status: 500 })
  }
}
