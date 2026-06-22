-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 017: booking_completed email type
--
--  Adds the client-facing "your tattoo is complete" email type, sent from
--  app/api/dashboard/booking-action/route.ts when an artist marks a booking
--  as completed.
--
--  Safe to run whether or not migration 016 has been applied yet — this
--  re-states the full constraint from scratch (idempotent, like all prior
--  migrations in this series).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
    'booking_pending',
    'booking_cancelled',
    'booking_completed',
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
