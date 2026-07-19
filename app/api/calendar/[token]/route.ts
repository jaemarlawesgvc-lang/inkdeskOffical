import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fromZonedTime } from 'date-fns-tz'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { CONSULTATION_DURATION_HOURS } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Self-contained iCal feed — no OAuth.
//
// GET /api/calendar/{token} returns a text/calendar VCALENDAR of the artist's
// upcoming confirmed / deposit_paid bookings so they can subscribe in Google or
// Apple Calendar (one-way sync — prevents personal double-booking). The only
// credential is the unguessable calendar_feed_token; the service-role admin
// client is used because there is no user session on a calendar-app request.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

// Escape RFC 5545 special characters in TEXT values.
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// UTC timestamp in iCal basic format: 20260720T140000Z
function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Fold lines to 75 octets per RFC 5545 (continuation lines start with a space).
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74))
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params

  const parsed = z.string().uuid().safeParse(token)
  if (!parsed.success) {
    return new NextResponse('Invalid calendar token', { status: 404 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('id, display_name, username, timezone')
    .eq('calendar_feed_token', parsed.data)
    .is('deleted_at', null)
    .maybeSingle()

  if (!artist) {
    return new NextResponse('Calendar not found', { status: 404 })
  }

  const timezone = (artist.timezone as string) || 'Europe/London'

  // Upcoming, active bookings only. Compare against today's date string.
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, client_name, booking_date, booking_time, duration_hours, status, description')
    .eq('artist_id', artist.id)
    .in('status', ['confirmed', 'deposit_paid'])
    .is('deleted_at', null)
    .gte('booking_date', todayStr)
    .not('booking_time', 'is', null)
    .order('booking_date', { ascending: true })

  const calName = `${(artist.display_name as string) || (artist.username as string) || 'Inkquire'} — Bookings`
  const dtstamp = toIcsUtc(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inkquire//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calName)}`,
    `X-WR-TIMEZONE:${icsEscape(timezone)}`,
  ]

  for (const b of bookings ?? []) {
    if (!b.booking_date || !b.booking_time) continue

    // booking_date + booking_time are in the artist's LOCAL timezone. Interpret
    // that wall-clock in the artist's zone, then convert to UTC for the feed.
    const startLocal = `${b.booking_date}T${(b.booking_time as string).slice(0, 5)}:00`
    const startUtc = fromZonedTime(startLocal, timezone)
    if (Number.isNaN(startUtc.getTime())) continue

    const durationHours = Number(b.duration_hours ?? CONSULTATION_DURATION_HOURS)
    const endUtc = new Date(startUtc.getTime() + durationHours * 60 * 60 * 1000)

    const summary = icsEscape(`${(b.client_name as string) || 'Booking'} (${b.status})`)
    const description = b.description ? icsEscape(b.description as string) : ''

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:booking-${b.id}@inkquire`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART:${toIcsUtc(startUtc)}`)
    lines.push(`DTEND:${toIcsUtc(endUtc)}`)
    lines.push(`SUMMARY:${summary}`)
    if (description) lines.push(`DESCRIPTION:${description}`)
    lines.push(`STATUS:CONFIRMED`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const body = lines.map(foldLine).join('\r\n') + '\r\n'

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="inkquire.ics"',
      'Cache-Control': 'no-cache, max-age=0',
    },
  })
}
