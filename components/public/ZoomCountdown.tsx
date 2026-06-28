'use client'

import { useEffect, useState, useCallback } from 'react'

interface ZoomCountdownProps {
  bookingDate: string
  bookingTime: string | null
  durationHours: number
  zoomLink: string | null
}

export function ZoomCountdown({
  bookingDate,
  bookingTime,
  durationHours,
  zoomLink,
}: ZoomCountdownProps) {
  const [status, setStatus] = useState<'upcoming' | 'active' | 'ended'>('upcoming')
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  const getMeetingTimes = useCallback(() => {
    if (!bookingTime) return null
    // bookingDate is YYYY-MM-DD, bookingTime is HH:MM
    const startStr = `${bookingDate}T${bookingTime.slice(0, 5)}:00`
    const startDate = new Date(startStr)
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000)
    return { startDate, endDate }
  }, [bookingDate, bookingTime, durationHours])

  useEffect(() => {
    const times = getMeetingTimes()
    if (!times) return

    const tick = () => {
      const now = new Date()
      const startDiff = times.startDate.getTime() - now.getTime()
      const endDiff = times.endDate.getTime() - now.getTime()

      if (startDiff > 0) {
        // Upcoming
        setStatus('upcoming')
        const days = Math.floor(startDiff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((startDiff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((startDiff / (1000 * 60)) % 60)
        const seconds = Math.floor((startDiff / 1000) % 60)
        setTimeLeft({ days, hours, minutes, seconds })
      } else if (endDiff > 0) {
        // Active
        setStatus('active')
      } else {
        // Ended
        setStatus('ended')
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [getMeetingTimes])

  if (!bookingTime) return null

  if (status === 'ended') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/40">
        The consultation meeting has ended.
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-widest">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Meeting is live now
        </div>
        <p className="text-sm text-white/70 max-w-sm mx-auto leading-relaxed">
          Your online video consultation is currently happening. Click the button below to join the call.
        </p>
        {zoomLink ? (
          <a
            href={zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold px-6 py-3 transition-colors active:scale-[0.98]"
          >
            Join Google Meet ↗
          </a>
        ) : (
          <div className="text-xs text-white/40">
            No meeting link was configured by the artist. Please contact the artist directly.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4 text-center">
      <div className="text-xs font-semibold text-white/50 uppercase tracking-widest">
        Upcoming Online Consultation
      </div>
      
      <div className="flex justify-center items-center gap-4 text-white">
        {timeLeft.days > 0 && (
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl font-bold tracking-tight">{timeLeft.days}</span>
            <span className="text-[10px] text-white/40 uppercase font-medium mt-1">Days</span>
          </div>
        )}
        {timeLeft.days > 0 && <span className="text-white/20 text-xl font-light">:</span>}
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold tracking-tight">
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-white/40 uppercase font-medium mt-1">Hours</span>
        </div>
        <span className="text-white/20 text-xl font-light">:</span>
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold tracking-tight">
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-white/40 uppercase font-medium mt-1">Mins</span>
        </div>
        <span className="text-white/20 text-xl font-light">:</span>
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold tracking-tight">
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-white/40 uppercase font-medium mt-1">Secs</span>
        </div>
      </div>

      <p className="text-xs text-white/40 leading-relaxed max-w-xs mx-auto">
        Scheduled for {bookingDate} at {bookingTime.slice(0, 5)}. The Google Meet button will become active here when the meeting starts.
      </p>

      {zoomLink && (
        <a
          href={zoomLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-4 py-2.5 transition-colors"
        >
          Open Google Meet ↗
        </a>
      )}
    </div>
  )
}
