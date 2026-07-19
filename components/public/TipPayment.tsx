'use client'

import { useState, useEffect } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe/client'

interface TipPaymentProps {
  artistId: string
  accentColor: string
  /** Optional booking this tip is associated with. */
  bookingId?: string
  /** Optional base amount (in pounds) used to compute percentage presets. */
  baseAmount?: number
  clientName?: string
  clientEmail?: string
  onSuccess?: () => void
}

const stripePromise = getStripeClient()

const PERCENT_PRESETS = [10, 15, 20] as const
const FLAT_PRESETS_PENCE = [500, 1000, 2000] as const // £5 / £10 / £20

// ── Inner Elements form ─────────────────────────────────────────────────────
function TipForm({
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
        Thank you! Your tip of £{(amountPence / 100).toFixed(2)} was sent.
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
        {submitting ? 'Processing…' : `Send £${(amountPence / 100).toFixed(2)} tip`}
      </button>

      <p className="text-white/30 text-xs text-center">
        Secured by Stripe. 100% goes to the artist.
      </p>
    </div>
  )
}

export function TipPayment({
  artistId,
  accentColor,
  bookingId,
  baseAmount,
  clientName,
  clientEmail,
  onSuccess,
}: TipPaymentProps) {
  const [selectedPence, setSelectedPence] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState('')
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

  // Build presets: percentage-based when a baseAmount is known, else flat.
  const presets: { label: string; pence: number }[] =
    baseAmount && baseAmount > 0
      ? PERCENT_PRESETS.map((pct) => ({
          label: `${pct}%`,
          pence: Math.round(baseAmount * 100 * (pct / 100)),
        }))
      : FLAT_PRESETS_PENCE.map((pence) => ({
          label: `£${(pence / 100).toFixed(0)}`,
          pence,
        }))

  const resolvedPence = (() => {
    if (selectedPence !== null) return selectedPence
    const parsed = Math.round(parseFloat(customValue) * 100)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  })()

  const startTip = async () => {
    if (!resolvedPence) {
      setError('Please choose or enter a tip amount.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          amountPence: resolvedPence,
          bookingId,
          clientName,
          clientEmail,
        }),
      })
      const json = (await res.json()) as { clientSecret?: string; error?: string }
      if (!res.ok || !json.clientSecret) {
        setError(json.error ?? 'Could not start tip payment.')
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

  // Once we have a client secret and Stripe is ready, mount the payment form.
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
        <TipForm amountPence={resolvedPence} accentColor={accentColor} onSuccess={onSuccess} />
      </Elements>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => {
          const active = selectedPence === preset.pence
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setSelectedPence(preset.pence)
                setCustomValue('')
              }}
              className="py-3 rounded-lg text-sm font-semibold border transition-all duration-150 active:scale-[0.98]"
              style={
                active
                  ? { backgroundColor: accentColor, color: '#0a0a0a', borderColor: accentColor }
                  : { borderColor: 'rgba(255,255,255,0.15)', color: '#f5f5f0' }
              }
            >
              {preset.label}
              <span className="block text-xs opacity-70">
                £{(preset.pence / 100).toFixed(2)}
              </span>
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1.5" htmlFor="custom-tip">
          Or enter a custom amount (£)
        </label>
        <input
          id="custom-tip"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value)
            setSelectedPence(null)
          }}
          placeholder="0.00"
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
        onClick={() => void startTip()}
        disabled={loading || !resolvedPence}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
      >
        {loading
          ? 'Starting…'
          : resolvedPence
            ? `Continue — £${(resolvedPence / 100).toFixed(2)}`
            : 'Choose a tip amount'}
      </button>
    </div>
  )
}
