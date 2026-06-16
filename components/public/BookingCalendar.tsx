'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface BookingCalendarProps {
  artistId: string
  selectedDate: string | null
  onDateSelect: (date: string) => void
  accentColor: string
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function BookingCalendar({
  artistId,
  selectedDate,
  onDateSelect,
  accentColor,
}: BookingCalendarProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [availableMap, setAvailableMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const fetchAvailability = useCallback(async () => {
    setLoading(true)
    const map: Record<string, boolean> = {}
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const checks: Promise<void>[] = []
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i)
      d.setHours(0, 0, 0, 0)
      const dateStr = formatYMD(d)

      if (d < today) {
        map[dateStr] = false
        continue
      }

      checks.push(
        fetch(`/api/booking/check-availability?artistId=${artistId}&date=${dateStr}`)
          .then((res) => res.json() as Promise<{ available: boolean }>)
          .then((json) => {
            map[dateStr] = json.available === true
          })
          .catch(() => {
            map[dateStr] = false
          }),
      )
    }

    await Promise.all(checks)
    setAvailableMap(map)
    setLoading(false)
  }, [artistId, viewYear, viewMonth, today])

  useEffect(() => {
    void fetchAvailability()
  }, [fetchAvailability])

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const isPrevDisabled =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={isPrevDisabled}
          aria-label="Previous month"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-white font-semibold text-sm" aria-live="polite">
          {loading ? 'Loading…' : monthLabel}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Next month"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-xs text-white/30 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Available dates">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" aria-hidden="true" />
          }

          const cellDate = new Date(viewYear, viewMonth, day)
          cellDate.setHours(0, 0, 0, 0)
          const dateStr = formatYMD(cellDate)
          const isPast = cellDate < today
          const available = (availableMap[dateStr] ?? false) && !isPast
          const isSelected = selectedDate === dateStr

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!available || loading}
              onClick={() => onDateSelect(dateStr)}
              aria-label={`${cellDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${available ? '' : ' — unavailable'}`}
              aria-pressed={isSelected}
              className={[
                'aspect-square rounded-lg text-sm font-medium flex items-center justify-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                isSelected
                  ? 'font-bold'
                  : available
                    ? 'text-white hover:bg-white/10'
                    : 'text-white/15 cursor-not-allowed',
              ].join(' ')}
              style={isSelected ? { backgroundColor: accentColor, color: '#0a0a0a' } : undefined}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
