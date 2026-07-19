import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createDepositSchema } from '@/lib/validations/stripe'
import { createDepositPaymentIntent } from '@/lib/stripe/server'
import { resolveActivePlan, checkBooleanFeature } from '@/lib/stripe/plans'

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
    .select('id, status, deposit_paid, stripe_payment_intent_id, access_token, deposit_amount, artist_id, client_email')
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

  try {
    const { clientSecret, paymentIntentId } = await createDepositPaymentIntent({
      amount: amountInPence,
      currency: 'gbp',
      bookingId,
      artistId: booking.artist_id,
      clientEmail: finalClientEmail,
      artistStripeAccountId: artist.stripe_connect_account_id,
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
