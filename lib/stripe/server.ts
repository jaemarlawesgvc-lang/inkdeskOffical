import Stripe from 'stripe'
import { env } from '@/lib/env'

// ---------------------------------------------------------------------------
// Stripe server instance (singleton)
// ---------------------------------------------------------------------------

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      typescript: true,
    })
  }
  return stripeInstance
}

// ---------------------------------------------------------------------------
// Price ID mapping
// ---------------------------------------------------------------------------

export const STRIPE_PRICE_IDS = {
  pro: env.STRIPE_PRICE_PRO_MONTHLY,
  studio: env.STRIPE_PRICE_STUDIO_MONTHLY,
} as const

export type PaidPlan = keyof typeof STRIPE_PRICE_IDS

export function priceIdToPlan(priceId: string): PaidPlan | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId) return plan as PaidPlan
  }
  return null
}

// ---------------------------------------------------------------------------
// Customer management
// ---------------------------------------------------------------------------

export async function createStripeCustomer(params: {
  email: string
  name?: string
  userId: string
}): Promise<string> {
  const stripe = getStripe()

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: {
      supabase_user_id: params.userId,
    },
  })

  return customer.id
}

export async function getOrCreateStripeCustomer(params: {
  userId: string
  email: string
  name?: string
  existingCustomerId: string | null
}): Promise<string> {
  if (params.existingCustomerId) {
    // Verify the customer still exists in Stripe
    const stripe = getStripe()
    try {
      const customer = await stripe.customers.retrieve(params.existingCustomerId)
      if (!customer.deleted) {
        return params.existingCustomerId
      }
    } catch {
      // Customer doesn't exist in Stripe — fall through to create
    }
  }

  return createStripeCustomer({
    email: params.email,
    name: params.name,
    userId: params.userId,
  })
}

// ---------------------------------------------------------------------------
// Subscription checkout
// ---------------------------------------------------------------------------

export async function createSubscriptionCheckout(params: {
  customerId: string
  priceId: string
  userId: string
  successUrl: string
  cancelUrl: string
  /**
   * Free-trial length in days. When > 0, Stripe collects the card but does not
   * charge until the trial ends, and reports the subscription as `trialing`.
   * Omit or pass 0 for an immediate charge.
   */
  trialPeriodDays?: number
}): Promise<string> {
  const stripe = getStripe()

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
      supabase_user_id: params.userId,
    },
  }

  if (params.trialPeriodDays && params.trialPeriodDays > 0) {
    subscriptionData.trial_period_days = params.trialPeriodDays
    // If the trial lapses without a usable card, cancel rather than dunning.
    subscriptionData.trial_settings = {
      end_behavior: { missing_payment_method: 'cancel' },
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      supabase_user_id: params.userId,
    },
    subscription_data: subscriptionData,
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  return session.url
}

// ---------------------------------------------------------------------------
// Billing portal
// ---------------------------------------------------------------------------

export async function createBillingPortalSession(params: {
  customerId: string
  returnUrl: string
}): Promise<string> {
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  })

  return session.url
}

// ---------------------------------------------------------------------------
// Deposit PaymentIntent
// ---------------------------------------------------------------------------

export async function createDepositPaymentIntent(params: {
  amount: number // in pence (smallest currency unit)
  currency: string
  bookingId: string
  artistId: string
  clientEmail: string
  artistStripeAccountId?: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe()

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: params.amount,
    currency: params.currency,
    metadata: {
      booking_id: params.bookingId,
      artist_id: params.artistId,
      client_email: params.clientEmail,
      type: 'deposit',
    },
    receipt_email: params.clientEmail,
    automatic_payment_methods: {
      enabled: true,
    },
  }

  // If artist has a connected Stripe account, route funds via Stripe Connect
  if (params.artistStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: params.artistStripeAccountId,
    }
  }

  // Idempotency: a rapid double-POST for the same booking reuses the same
  // intent instead of orphaning a duplicate. Only fires here (new-intent path);
  // reuse of an existing intent is handled before this function is called.
  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
    idempotencyKey: `deposit_booking_${params.bookingId}`,
  })

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

// ---------------------------------------------------------------------------
// Balance PaymentIntent (final balance after deposit)
// ---------------------------------------------------------------------------

/**
 * Collect the remaining balance for a booking (total − deposit). Mirrors
 * createDepositPaymentIntent exactly: a Connect destination charge that routes
 * the full amount to the artist's connected account, with NO platform
 * commission. `amount` MUST be derived server-side from the booking row.
 */
export async function createBalancePaymentIntent(params: {
  amount: number // in pence, server-derived (total − deposit)
  currency: string
  bookingId: string
  artistId: string
  clientEmail: string
  artistStripeAccountId?: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe()

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: params.amount,
    currency: params.currency,
    metadata: {
      kind: 'balance',
      booking_id: params.bookingId,
      artist_id: params.artistId,
      client_email: params.clientEmail,
    },
    receipt_email: params.clientEmail,
    automatic_payment_methods: {
      enabled: true,
    },
  }

  if (params.artistStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: params.artistStripeAccountId,
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
    idempotencyKey: `balance_booking_${params.bookingId}`,
  })

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

// ---------------------------------------------------------------------------
// Tip PaymentIntent
// ---------------------------------------------------------------------------

/**
 * Charge a tip that routes in full to the artist's connected account (no
 * platform commission). `amount` MUST be validated server-side (min/max)
 * before this is called.
 */
export async function createTipPaymentIntent(params: {
  amount: number // in pence, server-validated
  currency: string
  artistId: string
  bookingId?: string | null
  clientName?: string | null
  clientEmail?: string | null
  artistStripeAccountId?: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe()

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: params.amount,
    currency: params.currency,
    metadata: {
      kind: 'tip',
      artist_id: params.artistId,
      booking_id: params.bookingId ?? '',
      client_name: params.clientName ?? '',
    },
    automatic_payment_methods: {
      enabled: true,
    },
  }

  if (params.clientEmail) {
    paymentIntentParams.receipt_email = params.clientEmail
  }

  if (params.artistStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: params.artistStripeAccountId,
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

// ---------------------------------------------------------------------------
// Gift card PaymentIntent
// ---------------------------------------------------------------------------

/**
 * Charge a gift-card purchase that routes in full to the artist's connected
 * account (no platform commission). The gift_cards row (with its generated
 * code) is created by the webhook once payment succeeds. `amount` MUST be
 * validated server-side before this is called.
 */
export async function createGiftCardPaymentIntent(params: {
  amount: number // in pence, server-validated
  currency: string
  artistId: string
  purchaserEmail: string
  recipientEmail?: string | null
  artistStripeAccountId?: string
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe()

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: params.amount,
    currency: params.currency,
    metadata: {
      kind: 'giftcard',
      artist_id: params.artistId,
      purchaser_email: params.purchaserEmail,
      recipient_email: params.recipientEmail ?? '',
    },
    receipt_email: params.purchaserEmail,
    automatic_payment_methods: {
      enabled: true,
    },
  }

  if (params.artistStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: params.artistStripeAccountId,
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}
