import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, type SendResult } from '@/lib/resend/client'
import {
  bookingConfirmationTemplate,
  artistNotificationTemplate,
  reminder48hTemplate,
  reminder7dayTemplate,
  aftercareTemplate,
  depositReceiptTemplate,
  reviewRequestTemplate,
  cancellationOpeningTemplate,
  newMessageNotificationTemplate,
  conversationInviteTemplate,
  type BookingEmailData,
} from '@/lib/resend/templates'
import { getAppUrl } from '@/lib/app-url'

// ---------------------------------------------------------------------------
// Shared data loader
// ---------------------------------------------------------------------------

export interface BookingWithArtist {
  bookingId: string
  artistId: string
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
  opts: { includeDashboardUrl: boolean; includeStatusUrl: boolean; includeConsentFormUrl?: boolean; includeAftercareGuideUrl?: boolean },
): BookingEmailData {
  const appUrl = getAppUrl()

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
    consentFormUrl: opts.includeConsentFormUrl
      ? `${appUrl}/consent?artist_id=${booking.artistId}&booking_id=${booking.bookingId}`
      : null,
    aftercareGuideUrl: opts.includeAftercareGuideUrl
      ? `${appUrl}/api/aftercare-guide?artist_id=${booking.artistId}`
      : null,
    artistEmail: booking.artistEmail,
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
    includeConsentFormUrl: true,
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
// 3b. 7-Day Reminder → client
// ---------------------------------------------------------------------------

export async function sendReminder7day(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
): Promise<SendResult> {
  const data = buildEmailData(booking, {
    includeDashboardUrl: false,
    includeStatusUrl: true,
  })
  const { subject, html } = reminder7dayTemplate(data)

  return sendEmail({
    to: booking.clientEmail,
    subject,
    html,
    emailType: 'reminder_7day',
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
    includeAftercareGuideUrl: true,
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
// 5. Deposit Receipt → client (sent on payment_intent.succeeded)
// ---------------------------------------------------------------------------

export async function sendDepositReceipt(
  supabase: SupabaseClient,
  booking: BookingWithArtist,
  cardLast4: string | null,
): Promise<SendResult> {
  if (booking.depositAmount === null) {
    return { success: false, messageId: null, error: 'No deposit amount on booking', skipped: false }
  }

  const { subject, html } = depositReceiptTemplate({
    clientName: booking.clientName,
    artistName: booking.artistName,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    depositAmount: booking.depositAmount,
    paymentDate: new Date().toISOString(),
    cardLast4,
  })

  return sendEmail({
    to: booking.clientEmail,
    subject,
    html,
    emailType: 'deposit_receipt',
    bookingId: booking.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 6. Review Request → client (sent 24h after booking completion)
// ---------------------------------------------------------------------------

export async function sendReviewRequest(
  supabase: SupabaseClient,
  params: { bookingId: string; clientName: string; clientEmail: string; artistName: string; reviewToken: string },
): Promise<SendResult> {
  const { subject, html } = reviewRequestTemplate({
    clientName: params.clientName,
    artistName: params.artistName,
    reviewUrl: `${getAppUrl()}/review?token=${params.reviewToken}`,
  })

  return sendEmail({
    to: params.clientEmail,
    subject,
    html,
    emailType: 'review_request',
    bookingId: params.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 7. Cancellation Opening → pending/waitlisted client
// ---------------------------------------------------------------------------

export async function sendCancellationOpening(
  supabase: SupabaseClient,
  params: {
    bookingId: string | null
    clientName: string
    clientEmail: string
    artistName: string
    artistUsername: string
    openingDate: string
  },
): Promise<SendResult> {
  const { subject, html } = cancellationOpeningTemplate({
    clientName: params.clientName,
    artistName: params.artistName,
    openingDate: params.openingDate,
    bookingUrl: `${getAppUrl()}/${params.artistUsername}?date=${params.openingDate}`,
  })

  return sendEmail({
    to: params.clientEmail,
    subject,
    html,
    emailType: 'cancellation_opening',
    bookingId: params.bookingId,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 8. New Message Notification — to artist (client messaged) or client (artist replied)
//
// bookingId is intentionally always null here, even when the conversation has
// a linked booking. sendEmail() skips sending if it finds a prior 'sent' row
// for the same (bookingId, emailType) pair — that dedup exists so one-off
// per-booking emails (confirmation, receipt, etc.) don't double-send on
// retries. Messages are not one-off: every message must notify, so this must
// never take the dedup path.
// ---------------------------------------------------------------------------

export async function sendNewMessageNotification(
  supabase: SupabaseClient,
  params: {
    to: string
    recipientName: string
    senderName: string
    messagePreview: string
    conversationUrl: string
    artistEmail: string | null
  },
): Promise<SendResult> {
  const { subject, html } = newMessageNotificationTemplate({
    recipientName: params.recipientName,
    senderName: params.senderName,
    messagePreview: params.messagePreview.slice(0, 300),
    conversationUrl: params.conversationUrl,
    artistEmail: params.artistEmail,
  })

  return sendEmail({
    to: params.to,
    subject,
    html,
    emailType: 'new_message_notification',
    bookingId: null,
    userId: null,
    supabase,
  })
}

// ---------------------------------------------------------------------------
// 9. Conversation Invite — to client (sent once, when an artist starts a new conversation)
// ---------------------------------------------------------------------------

export async function sendConversationInvite(
  supabase: SupabaseClient,
  params: {
    to: string
    clientName: string
    artistName: string
    conversationUrl: string
    artistEmail: string | null
  },
): Promise<SendResult> {
  const { subject, html } = conversationInviteTemplate({
    clientName: params.clientName,
    artistName: params.artistName,
    conversationUrl: params.conversationUrl,
    artistEmail: params.artistEmail,
  })

  return sendEmail({
    to: params.to,
    subject,
    html,
    emailType: 'new_message_notification',
    bookingId: null,
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
      artist_id,
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
    artistId: booking.artist_id,
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
