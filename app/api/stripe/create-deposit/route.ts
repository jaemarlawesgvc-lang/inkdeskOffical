import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createDepositSchema } from '@/lib/validations/stripe'
import { createDepositPaymentIntent, getStripe } from '@/lib/stripe/server'
import { resolveActivePlan, checkBooleanFeature } from '@/lib/stripe/plans'
import { decrementGiftCardCAS } from '@/lib/stripe/webhook-process'
import { loadBookingWithArtist, sendBookingConfirmation, sendArtistNotification } from '@/lib/resend/send'
import { resolveStudioCommissionForArtist, computeCommissionFeePence } from '@/lib/studio/access'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Public endpoint: the booking client has no auth session. Access is gated
  // by the per-booking access_token issued at submit time, verified below.
  const supabase = createSupabaseAdminClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createDepositSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { bookingId, artistId, clientEmail, accessToken } = parsed.data

  // Load the booking first, so we know if a custom deposit has been set for this specific booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status, deposit_paid, stripe_payment_intent_id, access_token, deposit_amount, artist_id, client_email, gift_card_id, booking_date, booking_time')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.access_token !== accessToken) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 403 })
  }

  if (artistId && booking.artist_id !== artistId) {
    return NextResponse.json({ error: 'Artist ID mismatch' }, { status: 400 })
  }

  if (booking.deposit_paid) {
    return NextResponse.json({ error: 'Deposit has already been paid' }, { status: 409 })
  }

  // Load the artist and their subscription to enforce deposit feature gate
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, user_id, deposit_amount, deposit_required, stripe_connect_account_id, stripe_connect_status')
    .eq('id', booking.artist_id)
    .single()

  if (artistError || !artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  // Determine deposit amount: booking-specific takes precedence over artist-wide default
  const depositAmount = booking.deposit_amount !== null && booking.deposit_amount !== undefined
    ? Number(booking.deposit_amount)
    : (artist.deposit_required && artist.deposit_amount ? Number(artist.deposit_amount) : null)

  if (depositAmount === null || depositAmount <= 0) {
    return NextResponse.json(
      { error: 'This booking does not require a deposit' },
      { status: 422 },
    )
  }

  // Check the artist's subscription allows deposit collection
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', artist.user_id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)
  const depositCheck = checkBooleanFeature(plan, 'stripe_deposits')

  if (!depositCheck.allowed) {
    return NextResponse.json(
      {
        error: depositCheck.reason,
        currentPlan: depositCheck.currentPlan,
        requiredPlan: depositCheck.requiredPlan,
        upgradeUrl: depositCheck.upgradeUrl,
      },
      { status: 403 },
    )
  }

  // Deposits are routed in full to the artist's connected Stripe account (the
  // product takes NO commission). Refuse to collect a deposit unless the artist
  // has a fully-onboarded connected account — otherwise the client's money
  // would land on the platform balance with no mechanism to forward it on.
  if (
    !artist.stripe_connect_account_id ||
    artist.stripe_connect_status !== 'verified'
  ) {
    return NextResponse.json(
      {
        error:
          'This artist has not finished setting up deposit payouts yet. Please try again later or contact the artist.',
      },
      { status: 409 },
    )
  }

  // ── Gift-card path ────────────────────────────────────────────────────────
  // When a code is supplied, validate + price it server-side and either (a)
  // fully cover the deposit inline (no Stripe charge), or (b) create a reduced
  // PaymentIntent whose metadata carries the card so the webhook finalizes the
  // decrement + link atomically on payment success. The card is NEVER
  // decremented here for the partial path (only on payment success).
  const giftCardCode = parsed.data.giftCardCode?.trim()

  if (giftCardCode) {
    const amountDuePence = Math.round(depositAmount * 100)
    const normalizedCode = giftCardCode.toUpperCase()
    const finalClientEmail = clientEmail || booking.client_email

    const { data: card, error: cardErr } = await supabase
      .from('gift_cards')
      .select('id, status, remaining_amount_pence, expires_at')
      .eq('code', normalizedCode)
      .eq('artist_id', booking.artist_id)
      .maybeSingle()

    if (cardErr) {
      console.error('[create-deposit] gift card lookup error:', cardErr.message)
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

    const applied = Math.min(remaining, amountDuePence)
    const charged = amountDuePence - applied

    // ── Fully covered: no Stripe charge is possible, so finalize inline. ──
    if (charged <= 0) {
      // Idempotent CAS-claim: only the first request (deposit unpaid AND no card
      // linked yet) proceeds to decrement. A retry matches zero rows → no-op.
      const { data: claimed, error: claimErr } = await supabase
        .from('bookings')
        .update({
          gift_card_id: card.id,
          gift_card_amount_applied_pence: applied,
          deposit_paid: true,
          status: 'deposit_paid',
          stripe_payment_status: 'succeeded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('deposit_paid', false)
        .is('gift_card_id', null)
        .select('id')
        .maybeSingle()

      if (claimErr) {
        console.error('[create-deposit] gift card claim error:', claimErr.message)
        return NextResponse.json({ error: 'Failed to apply gift card' }, { status: 500 })
      }

      if (!claimed) {
        // Already applied by a prior request — idempotent success, NO re-decrement.
        return NextResponse.json({
          giftCardFullyCovered: true,
          depositPaid: true,
          appliedAmountPence: applied,
        })
      }

      const decremented = await decrementGiftCardCAS(supabase, card.id, applied)
      if (!decremented) {
        // Card was drained between preview and commit — roll the claim back so
        // the booking can be paid normally, and surface a retryable error.
        await supabase
          .from('bookings')
          .update({
            gift_card_id: null,
            gift_card_amount_applied_pence: 0,
            deposit_paid: false,
            status: booking.status,
            stripe_payment_status: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
        return NextResponse.json(
          { error: 'Gift card balance changed, please try again' },
          { status: 409 },
        )
      }

      // A fully gift-card-covered deposit creates no PaymentIntent, so the Stripe
      // webhook never fires. Run the same post-confirmation side-effects here that
      // the webhook would on a normal paid deposit: free the slot hold and notify.
      const deleteHold = supabase
        .from('booking_holds')
        .delete()
        .eq('artist_id', booking.artist_id)
        .eq('booking_date', booking.booking_date)
      if (booking.booking_time) deleteHold.eq('booking_time', booking.booking_time)
      await deleteHold

      const coveredBookingData = await loadBookingWithArtist(supabase, bookingId)
      if (coveredBookingData) {
        await Promise.allSettled([
          sendBookingConfirmation(supabase, coveredBookingData),
          sendArtistNotification(supabase, coveredBookingData),
        ])
      }

      return NextResponse.json({
        giftCardFullyCovered: true,
        depositPaid: true,
        appliedAmountPence: applied,
      })
    }

    // ── Partial: charge the remainder; the card decrements on payment success. ──
    // Studio commission (if any) is levied on the CHARGED remainder, not the
    // full deposit — solo artists get no fee and an unchanged destination charge.
    const gcCommission = await resolveStudioCommissionForArtist(booking.artist_id)
    const gcFeePence = gcCommission
      ? computeCommissionFeePence(charged, gcCommission.commissionRatePct)
      : 0

    try {
      const stripe = getStripe()
      const metadata: Record<string, string> = {
        booking_id: bookingId,
        artist_id: booking.artist_id,
        client_email: finalClientEmail,
        type: 'deposit',
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
          receipt_email: finalClientEmail,
          automatic_payment_methods: { enabled: true },
          transfer_data: { destination: artist.stripe_connect_account_id },
          ...(gcCommission && gcFeePence > 0
            ? { application_fee_amount: gcFeePence }
            : {}),
        },
        { idempotencyKey: `deposit_booking_${bookingId}_gc_${card.id}_${charged}` },
      )

      if (!paymentIntent.client_secret) {
        throw new Error('Stripe did not return a client secret')
      }

      await supabase
        .from('bookings')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          deposit_amount: depositAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        giftCardAppliedPence: applied,
        chargedAmountPence: charged,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deposit creation failed'
      console.error('[create-deposit] gift card Stripe error:', message)
      return NextResponse.json({ error: 'Failed to create deposit payment' }, { status: 500 })
    }
  }

  // If a PaymentIntent already exists for this booking, return its client secret
  // instead of creating a duplicate
  if (booking.stripe_payment_intent_id) {
    try {
      const { getStripe } = await import('@/lib/stripe/server')
      const stripe = getStripe()
      const existingIntent = await stripe.paymentIntents.retrieve(
        booking.stripe_payment_intent_id,
      )

      // Only reuse if the intent is still actionable and matching the required amount
      // Convert depositAmount to pence to compare with Stripe's amount
      const expectedAmountInPence = Math.round(depositAmount * 100)
      if (
        existingIntent.amount === expectedAmountInPence &&
        (existingIntent.status === 'requires_payment_method' ||
         existingIntent.status === 'requires_confirmation' ||
         existingIntent.status === 'requires_action')
      ) {
        return NextResponse.json({
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
        })
      }
    } catch {
      // Intent no longer valid or amount changed — fall through to create a new one
    }
  }

  // Convert deposit_amount (decimal pounds) to pence
  const amountInPence = Math.round(depositAmount * 100)

  const finalClientEmail = clientEmail || booking.client_email

  // Studio commission (if any) — levied on the full deposit for a studio artist
  // with a verified studio Connect account. Solo artists resolve to null → no
  // fee, unchanged 100%-to-artist destination charge.
  const commission = await resolveStudioCommissionForArtist(booking.artist_id)
  const applicationFeePence = commission
    ? computeCommissionFeePence(amountInPence, commission.commissionRatePct)
    : 0

  try {
    const { clientSecret, paymentIntentId } = await createDepositPaymentIntent({
      amount: amountInPence,
      currency: 'gbp',
      bookingId,
      artistId: booking.artist_id,
      clientEmail: finalClientEmail,
      artistStripeAccountId: artist.stripe_connect_account_id,
      applicationFeePence,
      studioId: commission?.studioId,
      studioConnectAccountId: commission?.studioConnectAccountId,
    })

    // Store the PaymentIntent ID and deposit amount on the booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntentId,
        deposit_amount: depositAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('[create-deposit] booking update error:', updateError.message)
      // Non-fatal — PaymentIntent was created successfully
    }

    return NextResponse.json({ clientSecret, paymentIntentId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deposit creation failed'
    console.error('[create-deposit] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to create deposit payment' }, { status: 500 })
  }
}
