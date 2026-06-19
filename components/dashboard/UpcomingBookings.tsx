import Link from 'next/link'
import { cn } from '@/lib/utils'

interface UpcomingBooking {
  id: string
  clientName: string
  bookingDate: string
  bookingTime: string | null
  status: string
  depositPaid: boolean
}

interface UpcomingBookingsProps {
  bookings: UpcomingBooking[]
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  deposit_paid: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
  completed: 'bg-white/10 text-white/50 border border-white/10',
  cancelled: 'bg-crimson-500/15 text-crimson-400 border border-crimson-500/25',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps) {
  if (bookings.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-12 text-center shadow-inset-top">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-30" />
        <div className="relative mx-auto flex max-w-xs flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/25 bg-gold-500/10 text-gold-500 shadow-gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
            </svg>
          </span>
          <p className="mt-4 font-display text-base font-bold text-white">A clear week ahead</p>
          <p className="mt-1 text-sm text-white/40">
            No bookings in the next 7 days. New requests will land here automatically.
          </p>
          <Link
            href="/dashboard/bookings"
            className="mt-4 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-300"
          >
            View all bookings →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-inset-top">
      <div className="divide-y divide-white/[0.06]">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between px-5 py-3.5 transition-colors duration-100 hover:bg-white/[0.03]"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-9 w-9 flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 text-sm font-semibold text-parchment-100 ring-1 ring-white/10">
                {booking.clientName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{booking.clientName}</p>
                <p className="text-xs text-white/40">
                  {formatDate(booking.bookingDate)}
                  {booking.bookingTime ? ` · ${booking.bookingTime}` : ''}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'ml-4 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                STATUS_STYLES[booking.status] ?? 'bg-white/10 text-white/50 border border-white/10',
              )}
            >
              {STATUS_LABEL[booking.status] ?? booking.status}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] px-5 py-3">
        <Link
          href="/dashboard/bookings"
          className="text-sm font-medium text-white/50 transition-colors duration-150 hover:text-gold-300"
        >
          View all bookings →
        </Link>
      </div>
    </div>
  )
}
