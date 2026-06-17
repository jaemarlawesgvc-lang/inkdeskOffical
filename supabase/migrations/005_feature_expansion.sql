-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 005: Tier 1 Feature Expansion
--
--  Covers:
--    Feature 2  Pricing notes on artists
--    Feature 5  Artist FAQ
--    Feature 6  Deposit receipt email type
--    Feature 7  Artist credentials (licenses, awards, publications)
--
--  Follows the conventions established in 001–003:
--    - public.current_artist_id() / public.is_admin() helper functions
--    - RLS enabled on every new table, deny-by-default
--    - Soft-delete via deleted_at where applicable
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 2 — Pricing notes
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS pricing_notes text CHECK (char_length(pricing_notes) <= 1000);

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 6 — email_logs: add deposit_receipt to the email_type CHECK
--
--  email_type is constrained by a CHECK, not a free-text column — must be
--  dropped and recreated to add a new allowed value.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

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
    'deposit_receipt'
  ));

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 5 — ARTIST FAQS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.artist_faqs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  question        text         NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  answer          text         NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 2000),
  display_order   integer      NOT NULL DEFAULT 0,
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  updated_at      timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX artist_faqs_artist_idx
  ON public.artist_faqs (artist_id, display_order);

CREATE TRIGGER set_artist_faqs_updated_at
  BEFORE UPDATE ON public.artist_faqs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.artist_faqs ENABLE ROW LEVEL SECURITY;

-- Public: read FAQs for any onboarded, non-deleted artist
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

-- Artists manage their own FAQs
CREATE POLICY "artist_faqs_artist_all"
  ON public.artist_faqs FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "artist_faqs_admin_all"
  ON public.artist_faqs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 7 — ARTIST CREDENTIALS (licenses, awards, publications)
--
--  Licenses are private (verified badge only, document never exposed publicly).
--  Awards and publications are public once added.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.artist_credentials (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  type            text         NOT NULL CHECK (type IN ('license', 'award', 'publication')),
  title           text         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  issuing_body    text         CHECK (char_length(issuing_body) <= 200),
  year            integer      CHECK (year BETWEEN 1900 AND 2100),
  expiry_date     date,
  url             text         CHECK (char_length(url) <= 2000),
  -- Storage path within the private 'credentials' bucket (licenses only)
  storage_path    text,
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  updated_at      timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

CREATE INDEX artist_credentials_artist_idx
  ON public.artist_credentials (artist_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_artist_credentials_updated_at
  BEFORE UPDATE ON public.artist_credentials
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.artist_credentials ENABLE ROW LEVEL SECURITY;

-- Public: read awards/publications only — never licenses (document privacy)
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

-- Artists manage all of their own credentials, including licenses
CREATE POLICY "artist_credentials_artist_all"
  ON public.artist_credentials FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "artist_credentials_admin_all"
  ON public.artist_credentials FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
