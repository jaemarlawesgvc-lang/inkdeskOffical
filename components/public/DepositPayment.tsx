'use client'

import { useState, useEffect } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe/client'

interface DepositPaymentProps {
  clientSecret: string
  depositAmount: number
  accentColor: string
  onSuccess: () => void
  onError: (message: string) => void
}

const stripePromise = getStripeClient()

// Inner form that has access to the Stripe Elements context
function PaymentForm({
  depositAmount,
  accentColor,
  onSuccess,
  onError,
}: Omit<DepositPaymentProps, 'clientSecret'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!stripe || !elements) return

    setSubmitting(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      const msg = error.message ?? 'Payment failed. Please try again.'
      setMessage(msg)
      onError(msg)
      setSubmitting(false)
      return
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess()
      return
    }

    // Any non-succeeded terminal state
    if (paymentIntent && paymentIntent.status === 'processing') {
      onSuccess()
      return
    }

    setMessage('Payment could not be completed. Please try again.')
    onError('Payment could not be completed.')
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {message && (
        <p className="text-red-400 text-sm" role="alert">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!stripe || !elements || submitting}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
      >
        {submitting ? 'Processing…' : `Pay £${depositAmount.toFixed(2)} deposit`}
      </button>

      <p className="text-white/30 text-xs text-center">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </div>
  )
}

export function DepositPayment({
  clientSecret,
  depositAmount,
  accentColor,
  onSuccess,
  onError,
}: DepositPaymentProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void stripePromise.then((s) => {
      if (active) setReady(s !== null)
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-8" role="status" aria-label="Loading payment form">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: accentColor,
            colorBackground: '#171717',
            colorText: '#f5f5f0',
            borderRadius: '8px',
          },
        },
      }}
    >
      <PaymentForm
        depositAmount={depositAmount}
        accentColor={accentColor}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}
