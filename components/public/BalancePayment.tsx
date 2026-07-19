'use client'

import { useState, useEffect } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe/client'

interface BalancePaymentProps {
  clientSecret: string
  balanceAmount: number // in pounds, for display only
  accentColor: string
  onSuccess: () => void
  onError: (message: string) => void
  // ── Optional: enable the "Have a gift card?" flow (see DepositPayment) ──
  bookingId?: string
  accessToken?: string | null
  artistId?: string
  clientEmail?: string | null
}

const stripePromise = getStripeClient()

// Inner form that has access to the Stripe Elements context
function PaymentForm({
  balanceAmount,
  accentColor,
  onSuccess,
  onError,
}: {
  balanceAmount: number
  accentColor: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
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

    if (
      paymentIntent &&
      (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')
    ) {
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
        {submitting ? 'Processing…' : `Pay £${balanceAmount.toFixed(2)} balance`}
      </button>

      <p className="text-white/30 text-xs text-center">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </div>
  )
}

// ── Optional gift-card entry panel ──
function GiftCardPanel({
  balanceAmount,
  accentColor,
  artistId,
  bookingId,
  accessToken,
  clientEmail,
  onApplied,
  onFullyCovered,
}: {
  balanceAmount: number
  accentColor: string
  artistId: string
  bookingId: string
  accessToken: string
  clientEmail?: string | null
  onApplied: (args: { clientSecret: string; chargedPence: number; appliedPence: number }) => void
  onFullyCovered: (appliedPence: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const handleApply = async () => {
    const trimmed = code.trim()
    if (trimmed.length < 4) {
      setError('Please enter a valid gift card code.')
      return
    }
    setBusy(true)
    setError(null)

    try {
      // 1) Preview: validate the code + report how much it would apply.
      const previewRes = await fetch('/api/giftcards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          artistId,
          amountPence: Math.round(balanceAmount * 100),
        }),
      })
      const preview = (await previewRes.json()) as {
        error?: string
        appliedAmountPence?: number
      }
      if (!previewRes.ok) {
        throw new Error(preview.error ?? 'That gift card could not be applied.')
      }

      // 2) Commit: re-create the balance PaymentIntent with the code so the
      //    charged amount is reduced. The real decrement happens on success.
      const applyRes = await fetch('/api/stripe/create-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          accessToken,
          clientEmail: clientEmail ?? undefined,
          giftCardCode: trimmed,
        }),
      })
      const data = (await applyRes.json()) as {
        error?: string
        clientSecret?: string
        giftCardFullyCovered?: boolean
        appliedAmountPence?: number
        giftCardAppliedPence?: number
        chargedAmountPence?: number
      }
      if (!applyRes.ok) {
        throw new Error(data.error ?? 'Failed to apply gift card.')
      }

      if (data.giftCardFullyCovered) {
        setApplied(true)
        onFullyCovered(data.appliedAmountPence ?? Math.round(balanceAmount * 100))
        return
      }

      if (data.clientSecret && typeof data.chargedAmountPence === 'number') {
        setApplied(true)
        onApplied({
          clientSecret: data.clientSecret,
          chargedPence: data.chargedAmountPence,
          appliedPence: data.giftCardAppliedPence ?? preview.appliedAmountPence ?? 0,
        })
        return
      }

      throw new Error('Unexpected response applying gift card.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (applied) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-white/60 hover:text-white underline underline-offset-2 transition-colors"
      >
        Have a gift card?
      </button>
    )
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
        Gift card code
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GIFT-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          disabled={busy}
          className="flex-1 min-w-0 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={busy}
          className="px-4 py-2 rounded-lg font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
        >
          {busy ? '…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function BalancePayment({
  clientSecret,
  balanceAmount,
  accentColor,
  onSuccess,
  onError,
  bookingId,
  accessToken,
  artistId,
  clientEmail,
}: BalancePaymentProps) {
  const [ready, setReady] = useState(false)
  const [activeClientSecret, setActiveClientSecret] = useState(clientSecret)
  const [displayAmount, setDisplayAmount] = useState(balanceAmount)
  const [appliedPence, setAppliedPence] = useState<number | null>(null)
  const [fullyCovered, setFullyCovered] = useState(false)

  useEffect(() => {
    let active = true
    void stripePromise.then((s) => {
      if (active) setReady(s !== null)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setActiveClientSecret(clientSecret)
  }, [clientSecret])

  const giftCardEnabled = Boolean(bookingId && accessToken && artistId)

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-8" role="status" aria-label="Loading payment form">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      </div>
    )
  }

  if (fullyCovered) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-4 rounded-xl text-center font-medium space-y-1">
        <p>Gift card applied — balance covered in full.</p>
        <p className="text-emerald-400/70 text-xs">Nothing left to pay.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {giftCardEnabled && (
        <GiftCardPanel
          balanceAmount={balanceAmount}
          accentColor={accentColor}
          artistId={artistId as string}
          bookingId={bookingId as string}
          accessToken={accessToken as string}
          clientEmail={clientEmail}
          onFullyCovered={() => setFullyCovered(true)}
          onApplied={({ clientSecret: cs, chargedPence, appliedPence: ap }) => {
            setAppliedPence(ap)
            setDisplayAmount(chargedPence / 100)
            setActiveClientSecret(cs)
          }}
        />
      )}

      {appliedPence !== null && (
        <div className="flex items-center justify-between bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg px-3 py-2 text-xs">
          <span className="text-emerald-400 font-semibold">
            Gift card applied: −£{(appliedPence / 100).toFixed(2)}
          </span>
          <span className="text-white/70">
            New total £{displayAmount.toFixed(2)}
          </span>
        </div>
      )}

      <Elements
        key={activeClientSecret}
        stripe={stripePromise}
        options={{
          clientSecret: activeClientSecret,
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
          balanceAmount={displayAmount}
          accentColor={accentColor}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  )
}
