import Link from 'next/link'

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
  pending: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  deposit_paid: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/15 text-red-400',
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
      <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-10 text-center">
        <p className="text-white/40 text-sm">No upcoming bookings in the next 7 days.</p>
        <Link
          href="/dashboard/bookings"
          className="inline-block mt-3 text-sm text-white underline underline-offset-2 hover:text-white/80 transition-colors"
        >
          View all bookings
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="divide-y divide-white/10">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors duration-100"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 select-none">
                {booking.clientName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{booking.clientName}</p>
                <p className="text-white/40 text-xs">
                  {formatDate(booking.bookingDate)}
                  {booking.bookingTime ? ` · ${booking.bookingTime}` : ''}
                </p>
              </div>
            </div>
            <span
              className={[
                'flex-shrink-0 ml-4 px-2.5 py-1 rounded-full text-xs font-semibold',
                STATUS_STYLES[booking.status] ?? 'bg-white/10 text-white/50',
              ].join(' ')}
            >
              {STATUS_LABEL[booking.status] ?? booking.status}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-white/10">
        <Link
          href="/dashboard/bookings"
          className="text-sm text-white/50 hover:text-white transition-colors duration-150"
        >
          View all bookings →
        </Link>
      </div>
    </div>
  )
}
