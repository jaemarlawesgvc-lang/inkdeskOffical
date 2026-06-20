-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 012: Catch-up / sync missing objects
--
--  Fully IDEMPOTENT. Safe to run on a database where migrations 005 and/or 009
--  were never applied (symptoms: PostgREST "Could not find the 'price_tier'
--  column of 'artists'", FAQ seeding fails because public.artist_faqs is missing).
--
--  Re-creates only what may be missing:
--    • artists.pricing_notes              (from 005)
--    • artists.price_tier                 (from 009)
--    • public.artist_faqs                 (from 005) + index, trigger, RLS
--    • public.artist_credentials          (from 005) + index, trigger, RLS
--    • public.consent_form_submissions    (from 011) + index, RLS, storage bucket
--
--  NOTE: artist_availability has NO timezone column by design — timezone lives
--  on artists.timezone (migration 001). Nothing to add here for that.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Ensure the shared updated_at trigger function exists ─────────────────────
-- (Defined in migration 001; recreated here so this script is self-contained
--  and never fails on a DB where 001 was incomplete.)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()))
  WITH CHECK (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

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
  USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()))
  WITH CHECK (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

-- ── consent_form_submissions (from 011) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_form_submissions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id           uuid        NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  booking_id          uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_name         text        NOT NULL,
  client_dob          date        NOT NULL,
  client_phone        text,
  tattoo_description  text        NOT NULL,
  age_confirmed       boolean     NOT NULL DEFAULT false,
  medical_answers     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  signature_name      text        NOT NULL,
  signed_at           timestamptz NOT NULL DEFAULT NOW(),
  ip_address          text,
  pdf_path            text,
  viewed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_submissions_artist
  ON public.consent_form_submissions (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_submissions_booking
  ON public.consent_form_submissions (booking_id);

ALTER TABLE public.consent_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artists_own_consent_submissions" ON public.consent_form_submissions;
CREATE POLICY "artists_own_consent_submissions"
  ON public.consent_form_submissions FOR SELECT
  USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "artists_update_own_consent_submissions" ON public.consent_form_submissions;
CREATE POLICY "artists_update_own_consent_submissions"
  ON public.consent_form_submissions FOR UPDATE
  USING (artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()));

-- email_logs: ensure the consent_form_submitted (and other newer) types are allowed
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

-- Private storage bucket for signed consent PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consent-forms', 'consent-forms', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "consent_forms_artist_select" ON storage.objects;
CREATE POLICY "consent_forms_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-forms'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.artists
      WHERE user_id = auth.uid() AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- ── Reload PostgREST schema cache so new columns/tables are visible at once ───
NOTIFY pgrst, 'reload schema';
