import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createBalanceSchema } from '@/lib/validations/stripe'
import { createBalancePaymentIntent, getStripe } from '@/lib/stripe/server'
import { decrementGiftCardCAS } from '@/lib/stripe/webhook-process'
import { resolveStudioCommissionForArtist, computeCommissionFeePence } from '@/lib/studio/access'

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
      'id, artist_id, access_token, client_email, deposit_amount, total_amount, total_amount_pence, balance_paid, balance_payment_intent_id, status, gift_card_id, gift_card_amount_applied_pence',
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

  // ── Gift-card path ────────────────────────────────────────────────────────
  // Mirrors create-deposit: validate + price the code server-side, then either
  // fully cover the balance inline (no charge) or create a reduced PaymentIntent
  // that carries the card in metadata for the webhook to finalize on success.
  const giftCardCode = parsed.data.giftCardCode?.trim()

  if (giftCardCode) {
    const normalizedCode = giftCardCode.toUpperCase()
    const finalGiftClientEmail = clientEmail || booking.client_email

    const { data: card, error: cardErr } = await supabase
      .from('gift_cards')
      .select('id, status, remaining_amount_pence, expires_at')
      .eq('code', normalizedCode)
      .eq('artist_id', booking.artist_id)
      .maybeSingle()

    if (cardErr) {
      console.error('[create-balance] gift card lookup error:', cardErr.message)
      return NextResponse.json({ error: 'Failed to look up gift card' }, { status: 500 })
    }
    if (!card) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
    }
    if (card.status !== 'active') {
      return NextResponse.json({ error: `Gift card is ${card.status}` }, { status: 409 })
    }
    if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Gift card has expired' }, { status: 409 })
    }

    const remaining = Number(card.remaining_amount_pence)
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Gift card has no remaining balance' }, { status: 409 })
    }

    const applied = Math.min(remaining, balancePence)
    const charged = balancePence - applied

    // ── Fully covered: finalize inline (no Stripe charge). ──
    if (charged <= 0) {
      // Idempotent CAS-claim gated on balance_paid=false. A retry no-ops.
      const { data: claimed, error: claimErr } = await supabase
        .from('bookings')
        .update({
          gift_card_id: card.id,
          gift_card_amount_applied_pence: applied,
          balance_paid: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('balance_paid', false)
        .select('id')
        .maybeSingle()

      if (claimErr) {
        console.error('[create-balance] gift card claim error:', claimErr.message)
        return NextResponse.json({ error: 'Failed to apply gift card' }, { status: 500 })
      }

      if (!claimed) {
        return NextResponse.json({
          giftCardFullyCovered: true,
          balancePaid: true,
          appliedAmountPence: applied,
        })
      }

      const decremented = await decrementGiftCardCAS(supabase, card.id, applied)
      if (!decremented) {
        // Roll the claim back to its prior state so the balance can be paid.
        await supabase
          .from('bookings')
          .update({
            gift_card_id: booking.gift_card_id ?? null,
            gift_card_amount_applied_pence:
              booking.gift_card_amount_applied_pence ?? 0,
            balance_paid: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
        return NextResponse.json(
          { error: 'Gift card balance changed, please try again' },
          { status: 409 },
        )
      }

      return NextResponse.json({
        giftCardFullyCovered: true,
        balancePaid: true,
        appliedAmountPence: applied,
      })
    }

    // ── Partial: charge the remainder; the card decrements on payment success. ──
    // Studio commission (if any) is levied on the CHARGED remainder.
    const gcCommission = await resolveStudioCommissionForArtist(booking.artist_id)
    const gcFeePence = gcCommission
      ? computeCommissionFeePence(charged, gcCommission.commissionRatePct)
      : 0

    try {
      const stripe = getStripe()
      const metadata: Record<string, string> = {
        kind: 'balance',
        booking_id: bookingId,
        artist_id: booking.artist_id,
        client_email: finalGiftClientEmail,
        gift_card_id: card.id,
        gift_card_applied_pence: String(applied),
      }
      if (gcCommission && gcFeePence > 0) {
        metadata.studio_id = gcCommission.studioId
        metadata.studio_connect_account_id = gcCommission.studioConnectAccountId
        metadata.studio_commission_pence = String(gcFeePence)
      }
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: charged,
          currency: 'gbp',
          metadata,
          receipt_email: finalGiftClientEmail,
          automatic_payment_methods: { enabled: true },
          transfer_data: { destination: artist.stripe_connect_account_id },
          ...(gcCommission && gcFeePence > 0
            ? { application_fee_amount: gcFeePence }
            : {}),
        },
        { idempotencyKey: `balance_booking_${bookingId}_gc_${card.id}_${charged}` },
      )

      if (!paymentIntent.client_secret) {
        throw new Error('Stripe did not return a client secret')
      }

      await supabase
        .from('bookings')
        .update({
          balance_payment_intent_id: paymentIntent.id,
          total_amount_pence: totalPence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountPence: charged,
        giftCardAppliedPence: applied,
        chargedAmountPence: charged,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Balance creation failed'
      console.error('[create-balance] gift card Stripe error:', message)
      return NextResponse.json({ error: 'Failed to create balance payment' }, { status: 500 })
    }
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

  // Studio commission (if any) — levied on the full balance for a studio artist
  // with a verified studio Connect account. Solo artists → null → no fee.
  const commission = await resolveStudioCommissionForArtist(booking.artist_id)
  const applicationFeePence = commission
    ? computeCommissionFeePence(balancePence, commission.commissionRatePct)
    : 0

  try {
    const { clientSecret, paymentIntentId } = await createBalancePaymentIntent({
      amount: balancePence,
      currency: 'gbp',
      bookingId,
      artistId: booking.artist_id,
      clientEmail: finalClientEmail,
      artistStripeAccountId: artist.stripe_connect_account_id,
      applicationFeePence,
      studioId: commission?.studioId,
      studioConnectAccountId: commission?.studioConnectAccountId,
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
