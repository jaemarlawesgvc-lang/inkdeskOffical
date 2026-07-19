import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createTipSchema } from '@/lib/validations/stripe'
import { createTipPaymentIntent } from '@/lib/stripe/server'

/**
 * POST /api/stripe/create-tip
 *
 * A client leaves a tip for an artist. The amount is validated server-side
 * (min/max enforced by createTipSchema) and charged in full to the artist's
 * connected account (no platform commission). The tips row is created by the
 * webhook once the PaymentIntent succeeds.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseAdminClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTipSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { artistId, amountPence, bookingId, clientName, clientEmail } = parsed.data

  // ── Load artist & require a verified Connect account ──
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, stripe_connect_account_id, stripe_connect_status')
    .eq('id', artistId)
    .single()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  if (
    !artist.stripe_connect_account_id ||
    artist.stripe_connect_status !== 'verified'
  ) {
    return NextResponse.json(
      {
        error:
          'This artist cannot accept tips yet — payouts are not fully set up.',
      },
      { status: 409 },
    )
  }

  // ── If a bookingId is supplied, ensure it belongs to this artist ──
  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, artist_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (!booking || booking.artist_id !== artistId) {
      return NextResponse.json(
        { error: 'Booking does not belong to this artist' },
        { status: 400 },
      )
    }
  }

  try {
    const { clientSecret, paymentIntentId } = await createTipPaymentIntent({
      amount: amountPence,
      currency: 'gbp',
      artistId,
      bookingId: bookingId ?? null,
      clientName: clientName ?? null,
      clientEmail: clientEmail ?? null,
      artistStripeAccountId: artist.stripe_connect_account_id,
    })

    return NextResponse.json({ clientSecret, paymentIntentId, amountPence })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tip creation failed'
    console.error('[create-tip] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to create tip payment' }, { status: 500 })
  }
}
