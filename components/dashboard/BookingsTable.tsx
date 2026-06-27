'use client'

import { useRef, useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan } from '@/lib/stripe/plans'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatBookingDuration } from '@/lib/booking/consultation-slots'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Booking {
  id: string
  client_name: string
  client_email: string
  client_phone: string | null
  booking_date: string
  booking_time: string | null
  duration_hours: number | null
  status: string
  deposit_amount: number | null
  deposit_paid: boolean
  description: string | null
  reference_images: string[] | null
  stripe_payment_status: string | null
  completed_photo_url: string | null
  created_at: string
  review: { id: string; rating: number | null; flagged: boolean } | null
  booking_type: string
  total_amount: number | null
}

interface BookingsTableProps {
  bookings: Booking[]
  artistId: string
  plan: Plan
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'deposit_paid', 'completed', 'cancelled']

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  deposit_paid: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/15 text-red-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function exportToCSV(bookings: Booking[]) {
  const headers = ['Client', 'Email', 'Phone', 'Date', 'Time', 'Status', 'Deposit', 'Description']
  const rows = bookings.map((b) => [
    b.client_name,
    b.client_email,
    b.client_phone ?? '',
    b.booking_date,
    b.booking_time ?? '',
    b.status,
    b.deposit_amount ? `£${b.deposit_amount}` : '',
    (b.description ?? '').replace(/,/g, ' '),
  ])

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingsTable({ bookings, artistId, plan }: BookingsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [noteValues, setNoteValues] = useState<Record<string, string>>({})
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Upgrade Modal states
  const [upgradingBooking, setUpgradingBooking] = useState<Booking | null>(null)
  const [upgradeDate, setUpgradeDate] = useState('')
  const [upgradeTime, setUpgradeTime] = useState('')
  const [upgradeDuration, setUpgradeDuration] = useState('2.0')
  const [upgradeTotal, setUpgradeTotal] = useState('')
  const [upgradeDeposit, setUpgradeDeposit] = useState('')
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handleUpgrade = async () => {
    if (!upgradingBooking) return
    setUpgradeError(null)
    setIsUpgrading(true)

    const dateVal = upgradeDate.trim()
    const timeVal = upgradeTime.trim()
    const durationVal = parseFloat(upgradeDuration)
    const totalVal = parseFloat(upgradeTotal)
    const depositVal = parseFloat(upgradeDeposit)

    if (!dateVal || !timeVal || isNaN(durationVal) || isNaN(totalVal) || isNaN(depositVal)) {
      setUpgradeError('All fields are required and must be valid numbers.')
      setIsUpgrading(false)
      return
    }

    try {
      const res = await fetch('/api/dashboard/booking-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: upgradingBooking.id,
          artistId,
          action: 'upgrade',
          bookingDate: dateVal,
          bookingTime: timeVal,
          durationHours: durationVal,
          totalAmount: totalVal,
          depositAmount: depositVal,
        }),
      })

      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Upgrade failed.')
      }

      setUpgradingBooking(null)
      startTransition(() => router.refresh())
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsUpgrading(false)
    }
  }

  const canExport = plan === 'pro' || plan === 'studio'

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (searchQuery && !b.client_name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (dateFrom && b.booking_date < dateFrom) return false
      if (dateTo && b.booking_date > dateTo) return false
      return true
    })
  }, [bookings, statusFilter, searchQuery, dateFrom, dateTo])

  // ── Booking action helper ──
  const performAction = async (bookingId: string, action: string, extraBody?: object) => {
    setActionError(null)
    const res = await fetch('/api/dashboard/booking-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, artistId, action, ...extraBody }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      setActionError(json.error ?? 'Action failed')
    } else {
      startTransition(() => router.refresh())
    }
  }

  // ── Message client (creates/reuses a conversation, then opens Messages) ──
  const [messagingId, setMessagingId] = useState<string | null>(null)

  const messageClient = async (booking: Booking) => {
    setMessagingId(booking.id)
    setActionError(null)
    try {
      const res = await fetch('/api/dashboard/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: booking.client_name,
          clientEmail: booking.client_email,
          bookingId: booking.id,
        }),
      })
      const data = (await res.json().catch(() => null)) as { conversation?: { id: string }; error?: string } | null
      if (!res.ok || !data?.conversation) {
        setActionError(data?.error ?? 'Failed to start conversation')
        return
      }
      router.push(`/dashboard/messages?c=${data.conversation.id}`)
    } catch {
      setActionError('Network error — could not start conversation.')
    } finally {
      setMessagingId(null)
    }
  }

  const saveNote = async (bookingId: string, note: string) => {
    setSavingNoteId(bookingId)
    await performAction(bookingId, 'add_note', { note })
    setSavingNoteId(null)
  }

  // ── Flag / unflag review ──
  const [flaggingId, setFlaggingId] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  const toggleFlagReview = async (reviewId: string, nextFlagged: boolean) => {
    setFlaggingId(reviewId)
    setActionError(null)
    const { error } = await supabase
      .from('reviews')
      .update({ flagged: nextFlagged, flagged_reason: nextFlagged ? 'Flagged by artist' : null })
      .eq('id', reviewId)
    if (error) setActionError(error.message)
    else startTransition(() => router.refresh())
    setFlaggingId(null)
  }

  // ── Completed-work photo upload ──
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const uploadCompletedPhoto = async (bookingId: string, file: File) => {
    setUploadingPhotoId(bookingId)
    setActionError(null)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('completed-work')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

    if (uploadError) {
      setActionError(uploadError.message)
      setUploadingPhotoId(null)
      return
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ completed_photo_url: path, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('artist_id', artistId)

    if (updateError) setActionError(updateError.message)
    else startTransition(() => router.refresh())
    setUploadingPhotoId(null)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <input
            type="search"
            placeholder="Search client name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/50 transition-colors appearance-none pr-8"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {s === 'all' ? 'All statuses' : (STATUS_LABEL[s] ?? s)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/50 transition-colors [color-scheme:dark]"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-white/5 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/50 transition-colors [color-scheme:dark]"
          aria-label="To date"
        />
        <button
          type="button"
          onClick={() => canExport && exportToCSV(filtered)}
          disabled={!canExport}
          title={canExport ? 'Export to CSV' : 'Export requires Pro or Studio plan'}
          className={[
            'px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-150',
            canExport
              ? 'border-white/20 text-white/70 hover:text-white hover:border-white/50'
              : 'border-white/10 text-white/20 cursor-not-allowed',
          ].join(' ')}
        >
          Export CSV
          {!canExport && <span className="ml-1.5 text-xs text-amber-500/70">Pro+</span>}
        </button>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm" role="alert">
          {actionError}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center">
          <p className="text-white/40 text-sm">No bookings match your filters.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/10">
            {filtered.map((booking) => {
              const isExpanded = expandedId === booking.id
              return (
                <div key={booking.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors duration-100 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 select-none">
                        {booking.client_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{booking.client_name}</p>
                        <p className="text-white/40 text-xs">
                          {formatDate(booking.booking_date)}
                          {booking.booking_time ? ` · ${booking.booking_time}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <span
                        className={[
                          'px-2.5 py-1 rounded-full text-xs font-semibold',
                          STATUS_STYLES[booking.status] ?? 'bg-white/10 text-white/50',
                        ].join(' ')}
                      >
                        {STATUS_LABEL[booking.status] ?? booking.status}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={[
                          'w-4 h-4 text-white/30 transition-transform duration-200',
                          isExpanded ? 'rotate-180' : '',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-white/[0.02] border-t border-white/10 space-y-4">
                      {/* Details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Email</p>
                          <p className="text-white text-sm">{booking.client_email}</p>
                        </div>
                        {booking.client_phone && (
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Phone</p>
                            <p className="text-white text-sm">{booking.client_phone}</p>
                          </div>
                        )}
                        {booking.deposit_amount && (
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Deposit</p>
                            <p className="text-white text-sm">
                              £{booking.deposit_amount.toFixed(2)}
                              <span className={['ml-1.5 text-xs', booking.deposit_paid ? 'text-emerald-400' : 'text-amber-400'].join(' ')}>
                                {booking.deposit_paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </p>
                          </div>
                        )}
                        {booking.duration_hours && (
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Duration</p>
                            <p className="text-white text-sm">{formatBookingDuration(booking.duration_hours)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Booked</p>
                          <p className="text-white text-sm">{formatDate(booking.created_at.slice(0, 10))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Booking Type</p>
                          <p className="text-white text-sm capitalize">{booking.booking_type || 'consultation'}</p>
                        </div>
                        {booking.total_amount !== null && booking.total_amount !== undefined && (
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Total Fee</p>
                            <p className="text-white text-sm">£{Number(booking.total_amount).toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      {booking.description && (
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Description</p>
                          <p className="text-white/70 text-sm leading-relaxed">{booking.description}</p>
                        </div>
                      )}

                      {/* Reference images */}
                      {booking.reference_images && booking.reference_images.length > 0 && (
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Reference images</p>
                          <div className="flex gap-2 flex-wrap">
                            {booking.reference_images.map((path, i) => (
                              <div
                                key={i}
                                className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-white/30 text-xs"
                                title={path}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Completed-work photo (only once marked completed) */}
                      {booking.status === 'completed' && (
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Completed-work photo</p>
                          {booking.completed_photo_url ? (
                            <p className="text-emerald-400 text-sm">Photo uploaded ✓</p>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => photoInputRefs.current[booking.id]?.click()}
                                disabled={uploadingPhotoId === booking.id}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                              >
                                {uploadingPhotoId === booking.id ? 'Uploading…' : 'Upload photo'}
                              </button>
                              <input
                                ref={(el) => { photoInputRefs.current[booking.id] = el }}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) void uploadCompletedPhoto(booking.id, file)
                                  e.target.value = ''
                                }}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {/* Review moderation */}
                      {booking.review && booking.review.rating !== null && (() => {
                        const review = booking.review
                        return (
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Client review</p>
                          <div className="flex items-center gap-3">
                            <span className="text-white text-sm">{review.rating} / 5</span>
                            <button
                              type="button"
                              onClick={() => toggleFlagReview(review.id, !review.flagged)}
                              disabled={flaggingId === review.id}
                              className={[
                                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40',
                                review.flagged
                                  ? 'bg-white/10 text-white/60 hover:bg-white/20'
                                  : 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
                              ].join(' ')}
                            >
                              {review.flagged ? 'Unflag review' : 'Flag review'}
                            </button>
                          </div>
                        </div>
                        )
                      })()}

                      {/* Note field */}
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Add note</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a note about this booking…"
                            value={noteValues[booking.id] ?? ''}
                            onChange={(e) =>
                              setNoteValues((prev) => ({ ...prev, [booking.id]: e.target.value }))
                            }
                            className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => saveNote(booking.id, noteValues[booking.id] ?? '')}
                            disabled={savingNoteId === booking.id || !noteValues[booking.id]}
                            className="px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {savingNoteId === booking.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => messageClient(booking)}
                          disabled={messagingId === booking.id}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                        >
                          {messagingId === booking.id ? 'Opening…' : 'Message'}
                        </button>
                        {/* Upgrade button - show if booking is a consultation and confirmed/paid */}
                        {booking.booking_type === 'consultation' && (booking.status === 'confirmed' || booking.status === 'deposit_paid') && (
                          <button
                            type="button"
                            onClick={() => {
                              setUpgradingBooking(booking)
                              setUpgradeDate(booking.booking_date)
                              setUpgradeTime(booking.booking_time || '')
                              setUpgradeDuration('2.0')
                              setUpgradeTotal('')
                              setUpgradeDeposit('')
                              setUpgradeError(null)
                            }}
                            className="px-4 py-2 bg-white text-black hover:bg-white/90 text-sm font-medium rounded-lg transition-colors animate-pulse"
                          >
                            Upgrade to Live Booking
                          </button>
                        )}

                        {/* Gated Confirm button for live bookings awaiting deposit */}
                        {booking.booking_type === 'live' && booking.status === 'pending' && booking.deposit_amount && booking.deposit_amount > 0 && !booking.deposit_paid ? (
                          <span className="inline-flex items-center text-amber-400 text-xs font-semibold px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            Awaiting client deposit
                          </span>
                        ) : (
                          // Show confirm button if pending OR if status is deposit_paid and booking is live
                          ((booking.status === 'pending') || (booking.status === 'deposit_paid' && booking.booking_type === 'live')) && (
                            <button
                              type="button"
                              onClick={() => performAction(booking.id, 'confirm')}
                              disabled={isPending}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                            >
                              Confirm
                            </button>
                          )
                        )}

                        {(booking.status === 'confirmed' || (booking.status === 'deposit_paid' && booking.booking_type !== 'live')) && (
                          <button
                            type="button"
                            onClick={() => performAction(booking.id, 'complete')}
                            disabled={isPending}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                          >
                            Mark complete
                          </button>
                        )}

                        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Cancel booking for ${booking.client_name}?`)) {
                                void performAction(booking.id, 'cancel')
                              }
                            }}
                            disabled={isPending}
                            className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Upgrade to Live Booking Modal Overlay */}
      {upgradingBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl text-left">
            <div className="flex items-center justify-between">
              <h3 id="upgrade-title" className="text-lg font-semibold text-white">Upgrade consultation for {upgradingBooking.client_name}</h3>
              <button
                type="button"
                onClick={() => setUpgradingBooking(null)}
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Close upgrade modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {upgradeError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                {upgradeError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1 font-medium">Tattoo Session Date</label>
                <input
                  type="date"
                  value={upgradeDate}
                  onChange={(e) => setUpgradeDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors [color-scheme:dark]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1 font-medium">Session Start Time</label>
                  <input
                    type="time"
                    value={upgradeTime}
                    onChange={(e) => setUpgradeTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors [color-scheme:dark]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1 font-medium">Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="16"
                    value={upgradeDuration}
                    onChange={(e) => setUpgradeDuration(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1 font-medium">Full Fee (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500.00"
                    value={upgradeTotal}
                    onChange={(e) => setUpgradeTotal(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1 font-medium">Deposit Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 50.00"
                    value={upgradeDeposit}
                    onChange={(e) => setUpgradeDeposit(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="w-full py-3 bg-white hover:bg-white/90 text-black font-semibold rounded-lg text-sm transition-colors mt-2"
              >
                {isUpgrading ? 'Upgrading…' : 'Upgrade to Live Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
