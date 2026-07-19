import { Resend } from 'resend'
import { env } from '@/lib/env'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Singleton Resend instance
// ---------------------------------------------------------------------------

let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(env.RESEND_API_KEY)
  }
  return resendInstance
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailType =
  | 'booking_confirmation'
  | 'booking_pending'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'booking_upgraded'
  | 'booking_rescheduled'
  | 'artist_notification'
  | 'reminder_48h'
  | 'aftercare'
  | 'deposit_receipt'
  | 'reminder_7day'
  | 'review_request'
  | 'cancellation_opening'
  | 'new_message_notification'
  | 'consent_form_submitted'
  | 'healed_photo_request'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  emailType: EmailType
  bookingId: string | null
  userId: string | null
  supabase: SupabaseClient
}

export interface SendResult {
  success: boolean
  messageId: string | null
  error: string | null
  skipped: boolean
}

// ---------------------------------------------------------------------------
// Core send function
//
// - Checks email_logs for duplicate (booking_id + email_type)
// - Retries up to 3 times with exponential backoff
// - Logs every attempt to email_logs
// - Never throws — returns SendResult so callers don't crash
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const { to, subject, html, emailType, bookingId, userId, supabase } = params

  // ── Reserve the idempotency slot BEFORE sending ──
  // Insert the 'sent' row first and let the partial unique index
  // (booking_id, email_type) WHERE status = 'sent' arbitrate: a duplicate insert
  // fails with 23505, closing the check-then-send race where two concurrent
  // callers both passed the old SELECT and both sent. If the insert wins we hold
  // reservedLogId and are the sole sender.
  let reservedLogId: string | null = null
  if (bookingId) {
    const { data: reserved, error: reserveError } = await supabase
      .from('email_logs')
      .insert({
        booking_id: bookingId,
        user_id: userId,
        email_type: emailType,
        recipient_email: to,
        resend_message_id: null,
        status: 'sent',
        error: null,
      })
      .select('id')
      .single()

    if (reserveError) {
      // 23505 = unique_violation → this email is already reserved/sent. Skip.
      if ((reserveError as { code?: string }).code === '23505') {
        return { success: true, messageId: null, error: null, skipped: true }
      }
      // Any other insert failure: don't drop the email — fall through to send
      // and log via the legacy path (reservedLogId stays null).
      console.error('[resend] idempotency reservation failed:', reserveError.message)
    } else {
      reservedLogId = reserved?.id ?? null
    }
  }

  // ── Send with retry ──
  const resend = getResend()
  let lastError: string | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      })

      if (error) {
        lastError = error.message
        if (attempt < MAX_RETRIES) {
          await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1))
          continue
        }
        break
      }

      const messageId = data?.id ?? null

      // ── Record success ──
      if (reservedLogId) {
        // Attach the Resend message id to the reservation we already inserted.
        await supabase
          .from('email_logs')
          .update({ resend_message_id: messageId })
          .eq('id', reservedLogId)
      } else {
        // No reservation (no bookingId, or reservation insert errored) — log now.
        await logEmail(supabase, {
          bookingId,
          userId,
          emailType,
          recipientEmail: to,
          resendMessageId: messageId,
          status: 'sent',
          error: null,
        })
      }

      return { success: true, messageId, error: null, skipped: false }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown send error'
      if (attempt < MAX_RETRIES) {
        await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1))
        continue
      }
    }
  }

  // ── All retries exhausted — record failure ──
  if (reservedLogId) {
    // Downgrade the reservation to 'failed' so it leaves the partial unique
    // index and a later retry can reserve + send again.
    await supabase
      .from('email_logs')
      .update({ status: 'failed', error: lastError })
      .eq('id', reservedLogId)
  } else {
    await logEmail(supabase, {
      bookingId,
      userId,
      emailType,
      recipientEmail: to,
      resendMessageId: null,
      status: 'failed',
      error: lastError,
    })
  }

  console.error(
    `[resend] Failed to send ${emailType} to ${to} after ${MAX_RETRIES} attempts: ${lastError}`,
  )

  return { success: false, messageId: null, error: lastError, skipped: false }
}

// ---------------------------------------------------------------------------
// email_logs persistence
// ---------------------------------------------------------------------------

interface LogParams {
  bookingId: string | null
  userId: string | null
  emailType: EmailType
  recipientEmail: string
  resendMessageId: string | null
  status: 'sent' | 'failed'
  error: string | null
}

async function logEmail(supabase: SupabaseClient, params: LogParams): Promise<void> {
  try {
    await supabase.from('email_logs').insert({
      booking_id: params.bookingId,
      user_id: params.userId,
      email_type: params.emailType,
      recipient_email: params.recipientEmail,
      resend_message_id: params.resendMessageId,
      status: params.status,
      error: params.error,
    })
  } catch (logErr) {
    // Never crash on logging failure
    console.error(
      '[resend] Failed to write email_logs:',
      logErr instanceof Error ? logErr.message : logErr,
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
