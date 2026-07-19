-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 024: retention / automation
--
--  Adds the columns + email type behind three retention features:
--    1. No-show / deposit-forfeit automation + cancellation-window policy
--         • artists.cancellation_window_hours  — grace window before a passed,
--           unconfirmed booking may have its manual deposit forfeited.
--         • artists.auto_forfeit_no_shows       — artist opt-out toggle.
--         • bookings.deposit_forfeited           — idempotency flag; set once the
--           deposit has been captured (forfeited) for a no-show.
--    2. Healed-photo follow-up loop
--         • email_logs.email_type CHECK extended with 'healed_photo_request'
--           (sent ~21 days after a completed live tattoo booking).
--    3. Google-review funnel
--         • artists.google_review_url            — optional Google review link
--           surfaced in the review-request email + review success screen.
--
--  Fully idempotent — safe to re-run regardless of current state.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Cancellation window + no-show forfeit ─────────────────────────────────
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS cancellation_window_hours int DEFAULT 48;
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS auto_forfeit_no_shows boolean DEFAULT true;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_forfeited boolean DEFAULT false;

-- ── 3. Google-review funnel ──────────────────────────────────────────────────
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS google_review_url text;

-- ── 2. Healed-photo-request email type ───────────────────────────────────────
-- Re-state the full constraint from scratch (idempotent, like migrations 016/017).
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
    'consent_form_submitted',
    'healed_photo_request'
  ));

NOTIFY pgrst, 'reload schema';
