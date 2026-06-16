-- 004_booking_access_token.sql
-- Adds access_token to bookings for client-side status checks without auth.
-- The token is generated on booking creation and returned to the client.
-- Status lookups use the admin client, so no anon RLS policy is needed here
-- (preserving the approved "no anon INSERT/DELETE on bookings" pattern).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS access_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_access_token
  ON bookings (access_token)
  WHERE access_token IS NOT NULL;
