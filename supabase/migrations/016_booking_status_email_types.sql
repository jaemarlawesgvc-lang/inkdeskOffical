-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 016: booking_pending / booking_cancelled email types
--
--  Adds the two new client-facing booking-status email types used by:
--    • app/api/booking/submit/route.ts            (booking_pending — sent the
--      moment a booking request is received, regardless of deposit path)
--    • app/api/dashboard/booking-action/route.ts   (booking_cancelled — sent
--      when an artist cancels a booking from the dashboard)
--  booking_confirmation already existed and is now also sent from
--  booking-action on manual (non-deposit) confirm.
--
--  Fully idempotent — safe to re-run regardless of current state.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
    'booking_pending',
    'booking_cancelled',
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
