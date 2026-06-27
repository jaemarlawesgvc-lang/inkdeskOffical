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
