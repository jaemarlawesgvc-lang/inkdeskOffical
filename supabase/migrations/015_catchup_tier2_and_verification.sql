-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 015: Catch-up — Tier 2 features, credentials storage,
--                            verified badge
--
--  Fully IDEMPOTENT, same pattern as 012 / 014. Migration 012 already proved
--  this codebase has shipped migration files that were never actually run
--  against production (005/009/011), and 014 just found the same thing true
--  of 010/013 (messaging). This migration closes the remaining gaps that
--  012 did NOT cover, in case 006 / 007 / 008 — and the is_verified column
--  from 009 — were also never applied:
--
--    • artists.is_verified              (from 009 — 012 only re-added price_tier)
--    • artists.studio_lat / studio_lng  (from 007)
--    • bookings.completed_photo_url / style_tag (from 007)
--    • public.reviews                   (from 007) + index, trigger, RLS
--    • public.waitlist                  (from 007) + index, RLS
--    • storage bucket 'credentials' + policies        (from 006)
--    • storage buckets 'completed-work' / 'review-photos' + policies (from 008)
--
--  Symptoms this fixes if you're hitting them: verified badge never shows,
--  studio map pin missing, "Mark complete with photo" failing, Reviews or
--  Waitlist dashboard pages erroring/empty, license/award/review-photo
--  uploads failing.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Defensive: re-assert helper functions (CREATE OR REPLACE is always safe) ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_artist_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.artists WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- ── artists: is_verified (009) + studio_lat/lng (007) ─────────────────────────
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS studio_lat numeric(10,7);
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS studio_lng numeric(10,7);

-- ── bookings: completed_photo_url + style_tag (007) ───────────────────────────
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_photo_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS style_tag text;

-- ── reviews (007) ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid         NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  artist_id          uuid         NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  client_name        text         NOT NULL,
  rating             integer      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  body               text         CHECK (body IS NULL OR char_length(body) <= 2000),
  photo_url          text,
  token              uuid         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_used         boolean      NOT NULL DEFAULT false,
  token_expires_at   timestamptz  NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  approved           boolean      NOT NULL DEFAULT true,
  flagged            boolean      NOT NULL DEFAULT false,
  flagged_reason     text,
  created_at         timestamptz  NOT NULL DEFAULT NOW(),
  updated_at         timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_artist_idx ON public.reviews (artist_id, created_at DESC);

DROP TRIGGER IF EXISTS set_reviews_updated_at ON public.reviews;
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_select" ON public.reviews;
CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT
  TO public
  USING (
    rating IS NOT NULL AND approved = true AND flagged = false
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = reviews.artist_id AND a.onboarding_complete = true AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "reviews_artist_select" ON public.reviews;
CREATE POLICY "reviews_artist_select"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "reviews_artist_update" ON public.reviews;
CREATE POLICY "reviews_artist_update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "reviews_admin_all" ON public.reviews;
CREATE POLICY "reviews_admin_all"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── waitlist (007) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id           uuid         NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  client_name         text         NOT NULL,
  client_email        text         NOT NULL,
  preferred_styles    text[]       NOT NULL DEFAULT '{}',
  flexible_on_date    boolean      NOT NULL DEFAULT true,
  preferred_date_from date,
  preferred_date_to   date,
  notified_at         timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waitlist_artist_idx ON public.waitlist (artist_id, created_at DESC);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_artist_all" ON public.waitlist;
CREATE POLICY "waitlist_artist_all"
  ON public.waitlist FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "waitlist_admin_all" ON public.waitlist;
CREATE POLICY "waitlist_admin_all"
  ON public.waitlist FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "waitlist_public_insert" ON public.waitlist;
CREATE POLICY "waitlist_public_insert"
  ON public.waitlist FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = waitlist.artist_id AND a.onboarding_complete = true AND a.deleted_at IS NULL
    )
  );

-- ── storage: credentials bucket + policies (006) ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('credentials', 'credentials', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "credentials_artist_insert" ON storage.objects;
CREATE POLICY "credentials_artist_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'credentials'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.artists WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1
    )
  );

DROP POLICY IF EXISTS "credentials_artist_select" ON storage.objects;
CREATE POLICY "credentials_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'credentials' AND owner = auth.uid());

DROP POLICY IF EXISTS "credentials_artist_update" ON storage.objects;
CREATE POLICY "credentials_artist_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'credentials' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'credentials' AND owner = auth.uid());

DROP POLICY IF EXISTS "credentials_artist_delete" ON storage.objects;
CREATE POLICY "credentials_artist_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'credentials' AND owner = auth.uid());

-- ── storage: completed-work + review-photos buckets + policies (008) ──────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('completed-work', 'completed-work', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('review-photos', 'review-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "completed_work_artist_insert" ON storage.objects;
CREATE POLICY "completed_work_artist_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'completed-work'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.artists a ON a.id = b.artist_id
      WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL AND b.deleted_at IS NULL
        AND (storage.foldername(name))[1] = b.id::text
    )
  );

DROP POLICY IF EXISTS "completed_work_artist_select" ON storage.objects;
CREATE POLICY "completed_work_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'completed-work' AND owner = auth.uid());

DROP POLICY IF EXISTS "completed_work_artist_delete" ON storage.objects;
CREATE POLICY "completed_work_artist_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'completed-work' AND owner = auth.uid());

DROP POLICY IF EXISTS "review_photos_public_select" ON storage.objects;
CREATE POLICY "review_photos_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-photos');

-- ── email_logs: final, complete set of allowed types ──────────────────────────
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN (
    'booking_confirmation',
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

-- ── Reload PostgREST schema cache so new tables/columns are visible at once ──
NOTIFY pgrst, 'reload schema';
