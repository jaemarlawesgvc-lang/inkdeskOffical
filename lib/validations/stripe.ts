import { z } from 'zod'

// ---------------------------------------------------------------------------
// Create checkout session
// ---------------------------------------------------------------------------

export const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'studio'], {
    errorMap: () => ({ message: 'Plan must be "pro" or "studio"' }),
  }),
})

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>

// ---------------------------------------------------------------------------
// Create deposit PaymentIntent
// ---------------------------------------------------------------------------

export const createDepositSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  artistId: z.string().uuid('Invalid artist ID').optional(),
  clientEmail: z.string().email('Invalid client email').optional(),
  accessToken: z.string().min(1, 'Access token is required'),
})

export type CreateDepositInput = z.infer<typeof createDepositSchema>

// ---------------------------------------------------------------------------
// Create balance PaymentIntent (final balance after deposit)
// ---------------------------------------------------------------------------

export const createBalanceSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  accessToken: z.string().min(1, 'Access token is required'),
  clientEmail: z.string().email('Invalid client email').optional(),
})

export type CreateBalanceInput = z.infer<typeof createBalanceSchema>

// ---------------------------------------------------------------------------
// Create tip PaymentIntent
// ---------------------------------------------------------------------------

// Tip bounds enforced SERVER-SIDE — never trust a client-supplied amount blindly.
export const TIP_MIN_PENCE = 100 // £1
export const TIP_MAX_PENCE = 100_000 // £1,000

export const createTipSchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
  amountPence: z
    .number()
    .int('Tip amount must be a whole number of pence')
    .min(TIP_MIN_PENCE, `Tip must be at least £${(TIP_MIN_PENCE / 100).toFixed(0)}`)
    .max(TIP_MAX_PENCE, `Tip cannot exceed £${(TIP_MAX_PENCE / 100).toFixed(0)}`),
  bookingId: z.string().uuid('Invalid booking ID').optional(),
  clientName: z.string().max(120).optional(),
  clientEmail: z.string().email('Invalid client email').optional(),
})

export type CreateTipInput = z.infer<typeof createTipSchema>

// ---------------------------------------------------------------------------
// Gift cards
// ---------------------------------------------------------------------------

export const GIFTCARD_MIN_PENCE = 1000 // £10
export const GIFTCARD_MAX_PENCE = 500_000 // £5,000

export const purchaseGiftCardSchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
  amountPence: z
    .number()
    .int('Amount must be a whole number of pence')
    .min(GIFTCARD_MIN_PENCE, `Gift card must be at least £${(GIFTCARD_MIN_PENCE / 100).toFixed(0)}`)
    .max(GIFTCARD_MAX_PENCE, `Gift card cannot exceed £${(GIFTCARD_MAX_PENCE / 100).toFixed(0)}`),
  purchaserEmail: z.string().email('Invalid purchaser email'),
  recipientEmail: z.string().email('Invalid recipient email').optional(),
})

export type PurchaseGiftCardInput = z.infer<typeof purchaseGiftCardSchema>

export const redeemGiftCardSchema = z.object({
  code: z.string().min(4, 'Invalid gift card code'),
  artistId: z.string().uuid('Invalid artist ID'),
  // Optional amount to apply, in pence. When omitted, the full remaining
  // balance is returned without decrementing.
  amountPence: z.number().int().positive().optional(),
})

export type RedeemGiftCardInput = z.infer<typeof redeemGiftCardSchema>
