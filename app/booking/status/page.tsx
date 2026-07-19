'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { DepositPayment } from '@/components/public/DepositPayment'
import { ZoomCountdown } from '@/components/public/ZoomCountdown'
import { BookingCalendar } from '@/components/public/BookingCalendar'
import { ConsultationTimeSlots } from '@/components/public/ConsultationTimeSlots'

interface BookingInfo {
  bookingId: string
  artistId: string
  status: string
  bookingDate: string
  bookingTime: string | null
  bookingType: string
  clientName: string
  depositAmount: number | null
  depositPaid: boolean
  paymentStatus: string | null
  createdAt: string
  zoomLink: string | null
  durationHours: number
  artist: {
    displayName: string | null
    username: string | null
    studioName: string | null
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  deposit_paid: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-white/10 text-white/50 border-white/10',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid (Awaiting Artist Confirmation)',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function BookingStatusContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stripe elements config
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingSecret, setLoadingSecret] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  // Reschedule state
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null)
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = useState(false)

  const handleRescheduleSubmit = async () => {
    if (!rescheduleDate || !rescheduleTime || !booking) return
    setRescheduling(true)
    setRescheduleError(null)

    try {
      const res = await fetch('/api/booking/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          date: rescheduleDate,
          time: rescheduleTime,
          token,
        }),
      })

      const json = await res.json() as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? 'Reschedule failed.')
      }

      setRescheduleSuccess(true)
      setTimeout(() => {
        setRescheduleOpen(false)
        setRescheduleDate(null)
        setRescheduleTime(null)
        setRescheduleSuccess(false)
        void fetchStatus()
      }, 2000)
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRescheduling(false)
    }
  }

  const isRescheduleLocked = () => {
    if (!booking || !booking.bookingDate || !booking.bookingTime) return false
    const apptDateStr = `${booking.bookingDate}T${booking.bookingTime.slice(0, 5)}:00`
    const apptTime = new Date(apptDateStr).getTime()
    const now = new Date().getTime()
    const hoursDiff = (apptTime - now) / (1000 * 60 * 60)
    return hoursDiff < 48
  }

  const fetchStatus = async () => {
    if (!token) {
      setError('Missing booking access token. Please check the link in your email.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/booking/status?token=${token}`)
      if (!res.ok) {
        throw new Error('Booking not found.')
      }
      const data = (await res.json()) as BookingInfo
      setBooking(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [token])

  // Initialize deposit payment intent if deposit is required and unpaid
  useEffect(() => {
    if (!booking || paymentSuccess) return
    const requiresPayment =
      booking.status === 'pending' &&
      !booking.depositPaid &&
      booking.depositAmount !== null &&
      booking.depositAmount > 0

    if (!requiresPayment) return

    const getSecret = async () => {
      setLoadingSecret(true)
      setPaymentError(null)
      try {
        const res = await fetch('/api/stripe/create-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.bookingId,
            accessToken: token,
          }),
        })
        const data = (await res.json()) as { clientSecret?: string; error?: string }
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error ?? 'Failed to initialize payment form')
        }
        setClientSecret(data.clientSecret)
      } catch (err) {
        setPaymentError(err instanceof Error ? err.message : 'Failed to load checkout.')
      } finally {
        setLoadingSecret(false)
      }
    }

    void getSecret()
  }, [booking, token, paymentSuccess])

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true)
    setClientSecret(null)
    // Refetch status to show updated state from DB (Stripe webhook will set status to deposit_paid)
    setTimeout(() => {
      void fetchStatus()
    }, 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-white/60 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    )
  }

  const artistName = booking.artist?.displayName ?? booking.artist?.username ?? 'Artist'
  const studioName = booking.artist?.studioName ?? ''

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-1 select-none">
          <h1 className="text-2xl font-bold tracking-tight text-white">Inkquire</h1>
          <p className="text-xs text-white/40">Tattoo Booking & Scheduling Platform</p>
        </div>

        {/* Booking Card */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Appointment with {artistName}</h2>
              {studioName && <p className="text-white/45 text-sm">{studioName}</p>}
            </div>
            <div>
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLES[booking.status] ?? 'bg-white/10 text-white/50 border-white/10'}`}>
                {STATUS_LABEL[booking.status] ?? booking.status}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Date</p>
              <p className="font-medium">{formatDate(booking.bookingDate)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Time</p>
              <p className="font-medium">{booking.bookingTime ?? 'To be scheduled'}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Client</p>
              <p className="font-medium">{booking.clientName}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Deposit Status</p>
              <p className={`font-semibold ${booking.depositPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                {booking.depositPaid ? 'Paid ✓' : booking.depositAmount ? `£${booking.depositAmount.toFixed(2)} Required` : 'No Deposit Required'}
              </p>
            </div>
          </div>

          {/* Payment Element for deposit */}
          {!booking.depositPaid && booking.depositAmount && booking.depositAmount > 0 && booking.status === 'pending' && (
            <div className="border-t border-white/5 pt-6 space-y-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-1">Secure Booking Deposit</h3>
                <p className="text-white/60 text-xs leading-relaxed">
                  A deposit of <strong className="text-white">£{booking.depositAmount.toFixed(2)}</strong> is required to secure this appointment.
                </p>
              </div>

              {loadingSecret && (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {paymentError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                  {paymentError}
                </div>
              )}

              {clientSecret && (
                <div className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                  <Suspense fallback={<div className="h-40 animate-pulse bg-white/5 rounded-lg" />}>
                    <DepositPayment
                      clientSecret={clientSecret}
                      depositAmount={booking.depositAmount}
                      accentColor="#ffb700"
                      onSuccess={handlePaymentSuccess}
                      onError={(msg) => setPaymentError(msg)}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* Payment Success Confirmation Banner */}
          {paymentSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-4 rounded-xl text-center font-medium">
              Deposit paid successfully! Awaiting artist confirmation.
            </div>
          )}

          {/* Google Meet link — consultations only */}
          {booking.bookingType === 'consultation' && booking.zoomLink && (
            <div className="border-t border-white/5 pt-6">
              <ZoomCountdown
                bookingDate={booking.bookingDate}
                bookingTime={booking.bookingTime}
                durationHours={booking.durationHours}
                zoomLink={booking.zoomLink}
              />
            </div>
          )}

          {/* Reschedule Consultation Section */}
          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <div className="border-t border-white/5 pt-6 space-y-4">
              {isRescheduleLocked() ? (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-white/70">Rescheduling is locked within 48 hours of appointment</p>
                  <p className="text-xs text-white/40">Please contact your artist directly to request changes.</p>
                </div>
              ) : !rescheduleOpen ? (
                <button
                  type="button"
                  onClick={() => setRescheduleOpen(true)}
                  className="w-full py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  Reschedule {booking.bookingType === 'consultation' ? 'Consultation' : 'Appointment'}
                </button>
              ) : (
                <div className="space-y-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-semibold">Reschedule Appointment</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleOpen(false)
                        setRescheduleDate(null)
                        setRescheduleTime(null)
                        setRescheduleError(null)
                      }}
                      className="text-xs text-white/40 hover:text-white/70"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-white/50 uppercase tracking-widest">
                        1. Select New Date
                      </span>
                      <div className="bg-zinc-950 border border-white/10 rounded-lg p-2">
                        <BookingCalendar
                          artistId={booking.artistId}
                          selectedDate={rescheduleDate}
                          onDateSelect={(date) => {
                            setRescheduleDate(date)
                            setRescheduleTime(null)
                            setRescheduleError(null)
                          }}
                          accentColor="#ffb700"
                        />
                      </div>
                    </div>

                    {rescheduleDate && (
                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-white/50 uppercase tracking-widest">
                          2. Select New Time
                        </span>
                        <div className="bg-zinc-950 border border-white/10 rounded-lg p-2">
                          <ConsultationTimeSlots
                            artistId={booking.artistId}
                            selectedDate={rescheduleDate}
                            selectedTime={rescheduleTime}
                            onTimeSelect={(time) => {
                              setRescheduleTime(time)
                              setRescheduleError(null)
                            }}
                            accentColor="#ffb700"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {rescheduleError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                      {rescheduleError}
                    </div>
                  )}

                  {rescheduleSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg text-center font-medium">
                      Rescheduled successfully! Updating page...
                    </div>
                  )}

                  {rescheduleDate && rescheduleTime && !rescheduleSuccess && (
                    <button
                      type="button"
                      disabled={rescheduling}
                      onClick={handleRescheduleSubmit}
                      className="w-full py-2.5 px-4 bg-gold-500 hover:bg-gold-400 disabled:bg-zinc-800 disabled:text-white/30 text-black text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {rescheduling ? (
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        'Confirm Reschedule'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookingStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <BookingStatusContent />
    </Suspense>
  )
}
