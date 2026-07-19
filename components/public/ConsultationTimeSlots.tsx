'use client'

import { useState, useEffect, useCallback } from 'react'
import { CONSULTATION_DURATION_LABEL } from '@/lib/constants'

interface ConsultationSlot {
  time: string
  label: string
  available: boolean
}

interface ConsultationTimeSlotsProps {
  artistId: string
  selectedDate: string | null
  selectedTime: string | null
  onTimeSelect: (time: string) => void
  accentColor: string
}

export function ConsultationTimeSlots({
  artistId,
  selectedDate,
  selectedTime,
  onTimeSelect,
  accentColor,
}: ConsultationTimeSlotsProps) {
  const [slots, setSlots] = useState<ConsultationSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    if (!selectedDate) {
      setSlots([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/booking/available-slots?artistId=${artistId}&date=${selectedDate}`,
      )
      const json = (await res.json()) as {
        slots?: ConsultationSlot[]
        reason?: string | null
        error?: string
      }

      if (!res.ok) {
        setError(json.error ?? 'Could not load available times')
        setSlots([])
        return
      }

      setSlots(json.slots ?? [])
      if (json.reason) setError(json.reason)
    } catch {
      setError('Could not load available times')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [artistId, selectedDate])

  useEffect(() => {
    void fetchSlots()
  }, [fetchSlots])

  if (!selectedDate) {
    return (
      <p className="text-sm text-white/40 py-3 text-center">
        Select a date above to see available consultation times
      </p>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-busy="true" aria-label="Loading times">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  const availableSlots = slots.filter((s) => s.available)

  if (availableSlots.length === 0) {
    return (
      <p className="text-sm text-white/50 py-3 text-center" role="status">
        {error ?? 'No consultation slots left on this date — try another day.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        Each slot is a {CONSULTATION_DURATION_LABEL} consultation. Your tattoo session will be
        booked separately after you discuss your design.
      </p>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto overscroll-contain pr-1 -mr-1"
        role="listbox"
        aria-label="Available consultation times"
      >
        {availableSlots.map((slot) => {
          const isSelected = selectedTime === slot.time
          return (
            <button
              key={slot.time}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onTimeSelect(slot.time)}
              className={[
                'min-h-[48px] rounded-lg px-2 py-2.5 text-sm font-medium transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                'active:scale-[0.98]',
                isSelected ? 'font-bold shadow-md' : 'text-white bg-white/5 hover:bg-white/10 border border-white/10',
              ].join(' ')}
              style={
                isSelected
                  ? { backgroundColor: accentColor, color: '#0a0a0a', borderColor: accentColor }
                  : undefined
              }
            >
              {slot.label.split(' (')[0]}
            </button>
          )
        })}
      </div>

      {selectedTime && (
        <p className="text-sm text-white/60" aria-live="polite">
          Selected:{' '}
          <span className="font-medium text-white">
            {slots.find((s) => s.time === selectedTime)?.label ?? selectedTime}
          </span>
        </p>
      )}
    </div>
  )
}
