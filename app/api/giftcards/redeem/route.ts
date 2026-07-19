import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { redeemGiftCardSchema } from '@/lib/validations/stripe'

/**
 * POST /api/giftcards/redeem
 *
 * Validate a gift card for a given artist and (optionally) apply an amount
 * against it. Lookup is by code via the service-role client only — gift card
 * codes are never publicly enumerable. Validates: active + not expired +
 * sufficient remaining balance.
 *
 * When `amountPence` is supplied, the remaining balance is decremented using an
 * optimistic compare-and-swap (WHERE remaining_amount_pence = <observed>) so
 * two concurrent redemptions can never double-spend — the loser's update
 * matches zero rows and is retried against the fresh balance.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseAdminClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = redeemGiftCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { code, artistId, amountPence } = parsed.data
  const normalizedCode = code.trim().toUpperCase()

  // Retry loop for the optimistic compare-and-swap on concurrent redemptions.
  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: card, error: cardError } = await supabase
      .from('gift_cards')
      .select('id, artist_id, status, remaining_amount_pence, expires_at')
      .eq('code', normalizedCode)
      .eq('artist_id', artistId)
      .maybeSingle()

    if (cardError) {
      console.error('[giftcards/redeem] lookup error:', cardError.message)
      return NextResponse.json({ error: 'Failed to look up gift card' }, { status: 500 })
    }

    if (!card) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
    }

    if (card.status !== 'active') {
      return NextResponse.json(
        { error: `Gift card is ${card.status}` },
        { status: 409 },
      )
    }

    if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Gift card has expired' }, { status: 409 })
    }

    const remaining = Number(card.remaining_amount_pence)

    if (remaining <= 0) {
      return NextResponse.json({ error: 'Gift card has no remaining balance' }, { status: 409 })
    }

    // No amount supplied → validate only, report the redeemable balance.
    if (amountPence === undefined) {
      return NextResponse.json({
        valid: true,
        giftCardId: card.id,
        remainingAmountPence: remaining,
      })
    }

    if (amountPence > remaining) {
      return NextResponse.json(
        {
          error: 'Amount exceeds the gift card balance',
          remainingAmountPence: remaining,
        },
        { status: 422 },
      )
    }

    const newRemaining = remaining - amountPence
    const newStatus = newRemaining <= 0 ? 'redeemed' : 'active'

    // Compare-and-swap: only succeeds if the balance is still what we observed.
    const { data: updated, error: updateError } = await supabase
      .from('gift_cards')
      .update({
        remaining_amount_pence: newRemaining,
        status: newStatus,
      })
      .eq('id', card.id)
      .eq('remaining_amount_pence', remaining)
      .eq('status', 'active')
      .select('id, remaining_amount_pence, status')
      .maybeSingle()

    if (updateError) {
      console.error('[giftcards/redeem] update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to redeem gift card' }, { status: 500 })
    }

    if (updated) {
      return NextResponse.json({
        valid: true,
        giftCardId: updated.id,
        appliedAmountPence: amountPence,
        remainingAmountPence: Number(updated.remaining_amount_pence),
        status: updated.status,
      })
    }

    // CAS lost to a concurrent redemption — retry against the fresh balance.
  }

  return NextResponse.json(
    { error: 'Gift card is busy, please try again' },
    { status: 409 },
  )
}
