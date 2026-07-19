import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { purchaseGiftCardSchema } from '@/lib/validations/stripe'
import { createGiftCardPaymentIntent } from '@/lib/stripe/server'

/**
 * POST /api/giftcards/purchase
 *
 * A buyer purchases a gift card towards a specific artist. The amount is
 * validated server-side and charged in full to the artist's connected account
 * (no platform commission). The gift_cards row — with its generated unique
 * code — is created by the webhook once the PaymentIntent succeeds.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseAdminClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = purchaseGiftCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { artistId, amountPence, purchaserEmail, recipientEmail } = parsed.data

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
          'This artist cannot sell gift cards yet — payouts are not fully set up.',
      },
      { status: 409 },
    )
  }

  try {
    const { clientSecret, paymentIntentId } = await createGiftCardPaymentIntent({
      amount: amountPence,
      currency: 'gbp',
      artistId,
      purchaserEmail,
      recipientEmail: recipientEmail ?? null,
      artistStripeAccountId: artist.stripe_connect_account_id,
    })

    return NextResponse.json({ clientSecret, paymentIntentId, amountPence })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gift card purchase failed'
    console.error('[giftcards/purchase] Stripe error:', message)
    return NextResponse.json({ error: 'Failed to create gift card payment' }, { status: 500 })
  }
}
