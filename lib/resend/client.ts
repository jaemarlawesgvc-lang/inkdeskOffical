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
  | 'artist_notification'
  | 'reminder_48h'
  | 'aftercare'
  | 'deposit_receipt'
  | 'reminder_7day'
  | 'review_request'
  | 'cancellation_opening'
  | 'new_message_notification'

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

  // ── Duplicate check ──
  if (bookingId) {
    const { data: existing } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('email_type', emailType)
      .eq('status', 'sent')
      .maybeSingle()

    if (existing) {
      return { success: true, messageId: null, error: null, skipped: true }
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

      // ── Log success ──
      await logEmail(supabase, {
        bookingId,
        userId,
        emailType,
        recipientEmail: to,
        resendMessageId: messageId,
        status: 'sent',
        error: null,
      })

      return { success: true, messageId, error: null, skipped: false }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown send error'
      if (attempt < MAX_RETRIES) {
        await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1))
        continue
      }
    }
  }

  // ── All retries exhausted — log failure ──
  await logEmail(supabase, {
    bookingId,
    userId,
    emailType,
    recipientEmail: to,
    resendMessageId: null,
    status: 'failed',
    error: lastError,
  })

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
