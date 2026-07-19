import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { redeemGiftCardSchema } from '@/lib/validations/stripe'

/**
 * POST /api/giftcards/redeem
 *
 * VALIDATE / PREVIEW ONLY — this endpoint never mutates a gift card.
 *
 * It looks a card up by code (service-role only, so codes are never publicly
 * enumerable) and reports whether it can be applied for the given artist plus
 * how much of it *would* be applied against an optional `amountPence`. The
 * actual, authoritative decrement of `remaining_amount_pence` happens exactly
 * once — on payment success in the Stripe webhook, or inline in create-deposit
 * / create-balance when a card fully covers the amount due and no charge is
 * created. Keeping this route side-effect-free is what prevents a code from
 * ever being double-decremented (preview here + commit there).
 *
 * Validates: card exists for the artist, status 'active', not expired, and has
 * a positive remaining balance.
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
    return NextResponse.json({ error: `Gift card is ${card.status}` }, { status: 409 })
  }

  if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Gift card has expired' }, { status: 409 })
  }

  const remaining = Number(card.remaining_amount_pence)

  if (remaining <= 0) {
    return NextResponse.json({ error: 'Gift card has no remaining balance' }, { status: 409 })
  }

  // Preview only — never decrement here. When an amount to apply is supplied,
  // report how much of the card would be consumed (capped at the balance).
  const appliedAmountPence =
    amountPence === undefined ? undefined : Math.min(amountPence, remaining)

  return NextResponse.json({
    valid: true,
    giftCardId: card.id,
    remainingAmountPence: remaining,
    ...(appliedAmountPence !== undefined ? { appliedAmountPence } : {}),
  })
}
