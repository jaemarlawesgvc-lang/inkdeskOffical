-- ══════════════════════════════════════════════════════════════════════════════
--  Migration 021: Booking integrity fixes
--
--    Fix 1 — Widen the per-slot exclusion constraint to include 'pending', so a
--            just-created public booking (which starts as 'pending') deterministically
--            occupies its slot and cannot be double-booked at the DB level.
--    Fix 2 — Guard booking_holds against two active holds on the same slot with a
--            partial UNIQUE index. Expired holds are purged by the app before insert.
--    Fix 4 — Hot-path btree index for availability lookups on booking_holds, and
--            drop the redundant text access_token index (001 already made it uuid).
--
--  All statements are idempotent (IF EXISTS / IF NOT EXISTS / drop-then-add).
-- ══════════════════════════════════════════════════════════════════════════════


-- ─── Fix 1: widen no_overlapping_confirmed_bookings to cover 'pending' ─────────
--
-- Preserves the exact btree_gist tsrange('[)') half-open overlap logic from 001;
-- only the status set in the WHERE clause is widened.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_confirmed_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_confirmed_bookings
  EXCLUDE USING gist (
    artist_id WITH =,
    tsrange(
      (booking_date + booking_time)::timestamp,
      (booking_date + booking_time + (duration_hours * INTERVAL '1 hour'))::timestamp,
      '[)'
    ) WITH &&
  )
  WHERE (
    status IN ('pending', 'confirmed', 'deposit_paid')
    AND deleted_at IS NULL
  );


-- ─── Fix 2: prevent two active holds on the same slot ─────────────────────────
--
-- The app deletes expired holds for the (artist, date, time) before inserting,
-- so this index only ever collides with a genuinely active competing hold. The
-- insert then fails with 23505 and the API returns a clean "slot just taken".
-- Partial on booking_time IS NOT NULL: date-level (null-time) holds are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS booking_holds_active_slot_unique
  ON public.booking_holds (artist_id, booking_date, booking_time)
  WHERE booking_time IS NOT NULL;


-- ─── Fix 4: hot-path availability lookup index on booking_holds ────────────────
CREATE INDEX IF NOT EXISTS booking_holds_artist_date_idx
  ON public.booking_holds (artist_id, booking_date);


-- ─── Fix 4: standardise access_token on uuid (drop redundant text index) ───────
-- 001 defines access_token as uuid with unique index bookings_access_token_idx.
-- 004 re-added a redundant text index idx_bookings_access_token — drop it.
DROP INDEX IF EXISTS idx_bookings_access_token;


NOTIFY pgrst, 'reload schema';
