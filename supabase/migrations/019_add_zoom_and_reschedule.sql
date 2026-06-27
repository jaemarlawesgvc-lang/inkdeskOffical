-- Migration 019: Add zoom_link columns and reschedule email logging type

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS zoom_link text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS zoom_link text;

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
    'booking_pending',
    'booking_cancelled',
    'booking_completed',
    'booking_upgraded',
    'booking_rescheduled',
    'artist_notification',
    'reminder_48h',
    'reminder_7day',
    'aftercare',
    'payment_failed',
    'subscription_cancelled',
    'gdpr_export',
    'gdpr_deletion',
    'deposit_receipt',
    'review_request',
    'cancellation_opening',
    'new_message_notification',
    'consent_form_submitted'
  ));

NOTIFY pgrst, 'reload schema';
