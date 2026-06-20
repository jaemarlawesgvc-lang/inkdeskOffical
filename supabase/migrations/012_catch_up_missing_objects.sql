-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 012: Catch-up / sync missing objects
--
--  Fully IDEMPOTENT. Safe to run on a database where migrations 005 and/or 009
--  were never applied (symptoms: PostgREST "Could not find the 'price_tier'
--  column of 'artists'", FAQ seeding fails because public.artist_faqs is missing).
--
--  Re-creates only what may be missing:
--    • artists.pricing_notes        (from 005)
--    • artists.price_tier           (from 009)
--    • public.artist_faqs           (from 005) + index, trigger, RLS policies
--    • public.artist_credentials    (from 005) + index, trigger, RLS policies
--
--  NOTE: artist_availability has NO timezone column by design — timezone lives
--  on artists.timezone (migration 001). Nothing to add here for that.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── artists: pricing_notes + price_tier ──────────────────────────────────────
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS pricing_notes text
  CHECK (char_length(pricing_notes) <= 1000);

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS price_tier text NOT NULL DEFAULT '££'
  CHECK (price_tier IN ('£', '££', '£££'));

-- ── artist_faqs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artist_faqs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  question        text         NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  answer          text         NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 2000),
  display_order   integer      NOT NULL DEFAULT 0,
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  updated_at      timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_faqs_artist_idx
  ON public.artist_faqs (artist_id, display_order);

DROP TRIGGER IF EXISTS set_artist_faqs_updated_at ON public.artist_faqs;
CREATE TRIGGER set_artist_faqs_updated_at
  BEFORE UPDATE ON public.artist_faqs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.artist_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_faqs_public_select" ON public.artist_faqs;
CREATE POLICY "artist_faqs_public_select"
  ON public.artist_faqs FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_faqs.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "artist_faqs_artist_all" ON public.artist_faqs;
CREATE POLICY "artist_faqs_artist_all"
  ON public.artist_faqs FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "artist_faqs_admin_all" ON public.artist_faqs;
CREATE POLICY "artist_faqs_admin_all"
  ON public.artist_faqs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── artist_credentials ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artist_credentials (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  type            text         NOT NULL CHECK (type IN ('license', 'award', 'publication')),
  title           text         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  issuing_body    text         CHECK (char_length(issuing_body) <= 200),
  year            integer      CHECK (year BETWEEN 1900 AND 2100),
  expiry_date     date,
  url             text         CHECK (char_length(url) <= 2000),
  storage_path    text,
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  updated_at      timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS artist_credentials_artist_idx
  ON public.artist_credentials (artist_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_artist_credentials_updated_at ON public.artist_credentials;
CREATE TRIGGER set_artist_credentials_updated_at
  BEFORE UPDATE ON public.artist_credentials
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.artist_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_credentials_public_select" ON public.artist_credentials;
CREATE POLICY "artist_credentials_public_select"
  ON public.artist_credentials FOR SELECT
  TO public
  USING (
    deleted_at IS NULL
    AND type IN ('award', 'publication')
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_credentials.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "artist_credentials_artist_all" ON public.artist_credentials;
CREATE POLICY "artist_credentials_artist_all"
  ON public.artist_credentials FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "artist_credentials_admin_all" ON public.artist_credentials;
CREATE POLICY "artist_credentials_admin_all"
  ON public.artist_credentials FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Reload PostgREST schema cache so new columns/tables are visible at once ───
NOTIFY pgrst, 'reload schema';
