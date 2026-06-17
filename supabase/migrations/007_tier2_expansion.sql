-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 007: Tier 2 Feature Expansion
--
--  Covers:
--    Feature 8   Post-booking reviews
--    Feature 9   Booking completed-work photo
--    Feature 11  7-day reminder email type (SMS/Twilio explicitly out of scope)
--    Feature 12  Google Maps studio coordinates
--    Feature 14  Cancellation recovery + waitlist
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 12 — Studio coordinates
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS studio_lat numeric(10,7);
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS studio_lng numeric(10,7);

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 9 — Completed-work photo + style tag on bookings
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_photo_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS style_tag text;

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 11 — extend email_logs CHECK with new types
--  (deposit_receipt was added in 005; review_request / cancellation_opening /
--  reminder_7day are added here)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
    'artist_notification',
    'reminder_48h',
    'aftercare',
    'payment_failed',
    'subscription_cancelled',
    'gdpr_export',
    'gdpr_deletion',
    'deposit_receipt',
    'review_request',
    'cancellation_opening',
    'reminder_7day'
  ));

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 8 — REVIEWS
--
--  approved defaults to true (no moderation queue exists) — artists police
--  reviews after the fact via the flag action, which hides them immediately.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.reviews (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid         NOT NULL UNIQUE
                                   REFERENCES public.bookings(id) ON DELETE CASCADE,
  artist_id          uuid         NOT NULL
                                   REFERENCES public.artists(id) ON DELETE CASCADE,
  client_name        text         NOT NULL,
  -- Null until the client submits — the row is created up front (token
  -- issued in the review-request email) and filled in on submission.
  rating             integer      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  body               text         CHECK (body IS NULL OR char_length(body) <= 2000),
  photo_url          text,
  -- High-entropy token emailed to the client; service-role lookup only.
  token              uuid         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_used         boolean      NOT NULL DEFAULT false,
  token_expires_at   timestamptz  NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  approved           boolean      NOT NULL DEFAULT true,
  flagged            boolean      NOT NULL DEFAULT false,
  flagged_reason     text,
  created_at         timestamptz  NOT NULL DEFAULT NOW(),
  updated_at         timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX reviews_artist_idx
  ON public.reviews (artist_id, created_at DESC);

CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public: read approved, non-flagged reviews for any onboarded artist
CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT
  TO public
  USING (
    rating IS NOT NULL
    AND approved = true
    AND flagged = false
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = reviews.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

-- Artist can read all reviews for their own bookings (including flagged)
CREATE POLICY "reviews_artist_select"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (artist_id = public.current_artist_id());

-- Artist can flag/unflag their own reviews (application layer restricts which
-- columns are sent in the update payload)
CREATE POLICY "reviews_artist_update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "reviews_admin_all"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTE: No INSERT policy for authenticated/public — review creation goes
-- through POST /api/reviews using the service role after validating the
-- token server-side, matching the §3.3 booking-write pattern.

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 14 — WAITLIST
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.waitlist (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id           uuid         NOT NULL
                                    REFERENCES public.artists(id) ON DELETE CASCADE,
  client_name         text         NOT NULL,
  client_email        text         NOT NULL,
  preferred_styles    text[]       NOT NULL DEFAULT '{}',
  flexible_on_date    boolean      NOT NULL DEFAULT true,
  preferred_date_from date,
  preferred_date_to   date,
  notified_at         timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX waitlist_artist_idx
  ON public.waitlist (artist_id, created_at DESC);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Artist manages their own waitlist (view, mark notified, remove)
CREATE POLICY "waitlist_artist_all"
  ON public.waitlist FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "waitlist_admin_all"
  ON public.waitlist FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public (anon) can join an artist's waitlist — no auth required
CREATE POLICY "waitlist_public_insert"
  ON public.waitlist FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = waitlist.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );
