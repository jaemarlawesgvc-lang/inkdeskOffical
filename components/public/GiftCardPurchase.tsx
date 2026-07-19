'use client'

import { useState, useEffect } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe/client'

interface GiftCardPurchaseProps {
  artistId: string
  accentColor: string
  onSuccess?: () => void
}

const stripePromise = getStripeClient()

const AMOUNT_PRESETS_PENCE = [2500, 5000, 10000, 15000] as const // £25–£150

// ── Inner Elements form ─────────────────────────────────────────────────────
function GiftCardForm({
  amountPence,
  accentColor,
  onSuccess,
}: {
  amountPence: number
  accentColor: string
  onSuccess?: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      setMessage(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (
      paymentIntent &&
      (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')
    ) {
      setDone(true)
      onSuccess?.()
      return
    }

    setMessage('Payment could not be completed. Please try again.')
    setSubmitting(false)
  }

  if (done) {
    return (
      <p className="text-center text-sm py-6" style={{ color: accentColor }}>
        Gift card purchased! The code will be emailed to you shortly.
      </p>
    )
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
        {submitting ? 'Processing…' : `Buy £${(amountPence / 100).toFixed(2)} gift card`}
      </button>

      <p className="text-white/30 text-xs text-center">
        Secured by Stripe. 100% goes to the artist.
      </p>
    </div>
  )
}

export function GiftCardPurchase({ artistId, accentColor, onSuccess }: GiftCardPurchaseProps) {
  const [selectedPence, setSelectedPence] = useState<number>(AMOUNT_PRESETS_PENCE[1])
  const [customValue, setCustomValue] = useState('')
  const [purchaserEmail, setPurchaserEmail] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const resolvedPence = (() => {
    if (customValue.trim() !== '') {
      const parsed = Math.round(parseFloat(customValue) * 100)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
    return selectedPence
  })()

  const startPurchase = async () => {
    if (!resolvedPence) {
      setError('Please choose or enter an amount.')
      return
    }
    if (!purchaserEmail) {
      setError('Please enter your email so we can send the gift card.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/giftcards/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          amountPence: resolvedPence,
          purchaserEmail,
          recipientEmail: recipientEmail || undefined,
        }),
      })
      const json = (await res.json()) as { clientSecret?: string; error?: string }
      if (!res.ok || !json.clientSecret) {
        setError(json.error ?? 'Could not start gift card purchase.')
        setLoading(false)
        return
      }
      setClientSecret(json.clientSecret)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (clientSecret && ready && resolvedPence) {
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
        <GiftCardForm amountPence={resolvedPence} accentColor={accentColor} onSuccess={onSuccess} />
      </Elements>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {AMOUNT_PRESETS_PENCE.map((pence) => {
          const active = customValue.trim() === '' && selectedPence === pence
          return (
            <button
              key={pence}
              type="button"
              onClick={() => {
                setSelectedPence(pence)
                setCustomValue('')
              }}
              className="py-3 rounded-lg text-sm font-semibold border transition-all duration-150 active:scale-[0.98]"
              style={
                active
                  ? { backgroundColor: accentColor, color: '#0a0a0a', borderColor: accentColor }
                  : { borderColor: 'rgba(255,255,255,0.15)', color: '#f5f5f0' }
              }
            >
              £{(pence / 100).toFixed(0)}
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1.5" htmlFor="custom-giftcard">
          Or enter a custom amount (£)
        </label>
        <input
          id="custom-giftcard"
          type="number"
          inputMode="decimal"
          min="10"
          step="0.01"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: accentColor }}
        />
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1.5" htmlFor="giftcard-purchaser">
          Your email
        </label>
        <input
          id="giftcard-purchaser"
          type="email"
          value={purchaserEmail}
          onChange={(e) => setPurchaserEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: accentColor }}
        />
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1.5" htmlFor="giftcard-recipient">
          Recipient email (optional)
        </label>
        <input
          id="giftcard-recipient"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="friend@example.com"
          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: accentColor }}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void startPurchase()}
        disabled={loading || !resolvedPence}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
      >
        {loading
          ? 'Starting…'
          : resolvedPence
            ? `Continue — £${(resolvedPence / 100).toFixed(2)}`
            : 'Choose an amount'}
      </button>
    </div>
  )
}
