import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, type SendResult } from '@/lib/resend/client'
import {
  bookingConfirmationTemplate,
  artistNotificationTemplate,
  reminder48hTemplate,
  aftercareTemplate,
  type BookingEmailData,
} from '@/lib/resend/templates'
import { clientEnv } from '@/lib/env.client'

// ---------------------------------------------------------------------------
// Shared data loader
// ---------------------------------------------------------------------------

export interface BookingWithArtist {
  bookingId: string
  clientName: string
  clientEmail: string
  artistName: string
  artistEmail: string
  artistUserId: string
  bookingDate: string
  bookingTime: string | null
  depositAmount: number | null
  depositPaid: boolean
  description: string | null
  studioName: string | null
  studioAddress: string | null
  accessToken: string | null
}

function buildEmailData(
  booking: BookingWithArtist,
  opts: { includeDashboardUrl: boolean; includeStatusUrl: boolean },
): BookingEmailData {
  const appUrl = clientEnv.appUrl

  return {
    clientName: booking.clientName,
    artistName: booking.artistName,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    depositAmount: booking.depositAmount,
    depositPaid: booking.depositPaid,
    description: booking.description,
    studioName: booking.studioName,
    studioAddress: booking.studioAddress,
    dashboardUrl: opts.includeDashboardUrl
      ? `${appUrl}/dashboard/bookings`
      : '',
    statusUrl: opts.includeStatusUrl && booking.accessToken
      ? `${appUrl}/booking/status?token=${booking.accessToken}`
      : null,
  }
}

// ---------------------------------------------------------------------------
// 1. Booking Confirmation → client
// ---------------------------------------------------------------------------

export async function sendBookingConfirmation(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
): Promise<SendResult> {
  const data = buildEmailData(booking, {
    includeDashboardUrl: false,
    includeStatusUrl: true,
  })
  const { subject, html } = bookingConfirmationTemplate(data)

  return sendEmail({
    to: booking.clientEmail,
    subject,
    html,
    emailType: 'booking_confirmation',
    bookingId: booking.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 2. Artist Notification → artist
// ---------------------------------------------------------------------------

export async function sendArtistNotification(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
): Promise<SendResult> {
  const data = buildEmailData(booking, {
    includeDashboardUrl: true,
    includeStatusUrl: false,
  })
  const { subject, html } = artistNotificationTemplate(data)

  return sendEmail({
    to: booking.artistEmail,
    subject,
    html,
    emailType: 'artist_notification',
    bookingId: booking.bookingId,
    userId: booking.artistUserId,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 3. 48-Hour Reminder → client
// ---------------------------------------------------------------------------

export async function sendReminder48h(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
): Promise<SendResult> {
  const data = buildEmailData(booking, {
    includeDashboardUrl: false,
    includeStatusUrl: true,
  })
  const { subject, html } = reminder48hTemplate(data)

  return sendEmail({
    to: booking.clientEmail,
    subject,
    html,
    emailType: 'reminder_48h',
    bookingId: booking.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 4. Aftercare → client (24h after appointment)
// ---------------------------------------------------------------------------

export async function sendAftercare(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
): Promise<SendResult> {
  const data = buildEmailData(booking, {
    includeDashboardUrl: false,
    includeStatusUrl: false,
  })
  const { subject, html } = aftercareTemplate(data)

  return sendEmail({
    to: booking.clientEmail,
    subject,
    html,
    emailType: 'aftercare',
    bookingId: booking.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// Helper: load BookingWithArtist from DB (used by cron jobs and webhooks)
// ---------------------------------------------------------------------------

export async function loadBookingWithArtist(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<BookingWithArtist | null> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      client_name,
      client_email,
      booking_date,
      booking_time,
      deposit_amount,
      deposit_paid,
      description,
      access_token,
      artists (
        user_id,
        display_name,
        studio_name,
        studio_address,
        profiles (
          email
        )
      )
    `,
    )
    .eq('id', bookingId)
    .is('deleted_at', null)
    .single()

  if (error || !booking) return null

  const artist = booking.artists as unknown as {
    user_id: string
    display_name: string | null
    studio_name: string | null
    studio_address: string | null
    profiles: { email: string } | null
  } | null

  if (!artist || !artist.profiles) return null

  return {
    bookingId: booking.id,
    clientName: booking.client_name,
    clientEmail: booking.client_email,
    artistName: artist.display_name ?? 'Your artist',
    artistEmail: artist.profiles.email,
    artistUserId: artist.user_id,
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    depositAmount: booking.deposit_amount,
    depositPaid: booking.deposit_paid,
    description: booking.description,
    studioName: artist.studio_name,
    studioAddress: artist.studio_address,
    accessToken: booking.access_token,
  }
}
