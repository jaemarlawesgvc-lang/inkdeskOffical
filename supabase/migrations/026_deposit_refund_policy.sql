-- 026_deposit_refund_policy.sql
--
-- Real no-show protection on the immediate-capture deposit model.
--
-- Stripe manual-capture authorizations expire after ~7 days, which is unusable
-- for tattoo bookings routinely made weeks/months in advance. So instead of
-- manual capture, deposits are captured immediately (funds secured for any lead
-- time) and the forfeit-vs-refund decision is made at cancellation time:
--   • Cancelled EARLIER than the artist's cancellation window  → deposit refunded
--   • Cancelled LATER than the window, or a no-show            → deposit forfeited
--
-- `deposit_forfeited` already exists (migration 024). This adds the refund flag
-- so the outcome is queryable and refunds are idempotent.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_refunded boolean NOT NULL DEFAULT false;

-- Let the frozen booking-action decide "timely" against the artist's policy.
-- (cancellation_window_hours already added in migration 024.)

NOTIFY pgrst, 'reload schema';
