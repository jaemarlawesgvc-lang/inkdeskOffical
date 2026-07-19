import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createBalanceSchema } from '@/lib/validations/stripe'
import { createBalancePaymentIntent } from '@/lib/stripe/server'

/**
 * POST /api/stripe/create-balance
 *
 * Collect the remaining balance for a booking after the deposit. Public
 * endpoint gated by the per-booking access_token. The balance amount is
 * derived SERVER-SIDE from the booking row (total − deposit) — the client
 * never supplies an amount. Funds route in full to the artist's connected
 * account (no platform commission), mirroring the deposit flow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseAdminClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createBalanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { bookingId, accessToken, clientEmail } = parsed.data

  // ── Load booking ──
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, artist_id, access_token, client_email, deposit_amount, total_amount, total_amount_pence, balance_paid, balance_payment_intent_id, status',
    )
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.access_token !== accessToken) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 403 })
  }

  if (booking.balance_paid) {
    return NextResponse.json({ error: 'Balance has already been paid' }, { status: 409 })
  }

  // ── Derive total & balance SERVER-SIDE (in pence) ──
  // Prefer the authoritative integer-pence figure; fall back to the legacy
  // numeric-pounds total_amount if total_amount_pence has not been set.
  const totalPence =
    booking.total_amount_pence !== null && booking.total_amount_pence !== undefined
      ? Number(booking.total_amount_pence)
      : booking.total_amount !== null && booking.total_amount !== undefined
        ? Math.round(Number(booking.total_amount) * 100)
        : null

  if (totalPence === null || totalPence <= 0) {
    return NextResponse.json(
      { error: 'This booking has no total amount set, so no balance can be collected' },
      { status: 422 },
    )
  }

  const depositPence =
    booking.deposit_amount !== null && booking.deposit_amount !== undefined
      ? Math.round(Number(booking.deposit_amount) * 100)
      : 0

  const balancePence = totalPence - depositPence

  if (balancePence <= 0) {
    return NextResponse.json(
      { error: 'There is no outstanding balance on this booking' },
      { status: 422 },
    )
  }

  // ── Load artist & require a verified Connect account ──
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, stripe_connect_account_id, stripe_connect_status')
    .eq('id', booking.artist_id)
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
          'This artist has not finished setting up payouts yet. Please try again later or contact the artist.',
      },
      { status: 409 },
    )
  }

  // ── Reuse an existing actionable PaymentIntent if one matches ──
  if (booking.balance_payment_intent_id) {
    try {
      const { getStripe } = await import('@/lib/stripe/server')
      const stripe = getStripe()
      const existing = await stripe.paymentIntents.retrieve(
        booking.balance_payment_intent_id,
      )
      if (
        existing.amount === balancePence &&
        (existing.status === 'requires_payment_method' ||
          existing.status === 'requires_confirmation' ||
          existing.status === 'requires_action')
      ) {
        return NextResponse.json({
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
        })
      }
    } catch {
      // Fall through and create a fresh intent.
    }
  }

  const finalClientEmail = clientEmail || booking.client_email

  try {
    const { clientSecret, paymentIntentId } = await createBalancePaymentIntent({
      amount: balancePence,
      currency: 'gbp',
      bookingId,
      artistId: booking.artist_id,
      clientEmail: finalClientEmail,
      artistStripeAccountId: artist.stripe_connect_account_id,
    })

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        balance_payment_intent_id: paymentIntentId,
        total_amount_pence: totalPence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('[create-balance] booking update error:', updateError.message)
      // Non-fatal — the PaymentIntent was created successfully.
    }

    return NextResponse.json({ clientSecret, paymentIntentId, amountPence: balancePence })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Balance creation failed'
    console.error('[create-balance] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to create balance payment' }, { status: 500 })
  }
}
