import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { clientEnv } from '@/lib/env.client'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripeClient(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(clientEnv.stripePublishableKey)
  }
  return stripePromise
}
