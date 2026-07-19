'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface StudioBooking {
  id: string
  artistId: string
  artistName: string
  clientName: string
  bookingDate: string
  bookingTime: string
  durationHours: number
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-amber-300/80 border-amber-300/25',
  confirmed: 'text-emerald-300/80 border-emerald-300/25',
  deposit_paid: 'text-sky-300/80 border-sky-300/25',
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Aggregated upcoming bookings across every artist in the studio — a simple
 * shared calendar feed grouped by date. Read-only.
 */
export function StudioCalendar() {
  const [bookings, setBookings] = useState<StudioBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/studio/bookings')
        const json = (await res.json()) as { bookings?: StudioBooking[]; error?: string }
        if (!res.ok) throw new Error(json.error ?? 'Could not load calendar')
        setBookings(json.bookings ?? [])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load calendar')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  if (loading) {
    return <p className="text-white/30 text-sm">Loading calendar…</p>
  }

  if (bookings.length === 0) {
    return <p className="text-white/30 text-sm">No upcoming bookings across the studio.</p>
  }

  // Group by date.
  const byDate = new Map<string, StudioBooking[]>()
  for (const b of bookings) {
    const list = byDate.get(b.bookingDate) ?? []
    list.push(b)
    byDate.set(b.bookingDate, list)
  }

  return (
    <div className="space-y-5">
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date}>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">{formatDate(date)}</p>
          <ul className="mt-2 space-y-2">
            {list.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {b.bookingTime} · {b.clientName}
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {b.artistName} · {b.durationHours} hr
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 flex-shrink-0 ${
                    STATUS_STYLES[b.status] ?? 'text-white/40 border-white/15'
                  }`}
                >
                  {b.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
