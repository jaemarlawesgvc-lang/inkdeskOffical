-- ══════════════════════════════════════════════════════════════════════════════
--  Migration 025: Discovery / growth activation
--
--    Part A — Video portfolio
--      • portfolio_images.media_type  ('image' | 'video'), default 'image'
--      • portfolio_images.poster_url  (optional video poster / thumbnail)
--      • Widen the portfolio-images storage bucket to allow video MIME types and
--        a larger file-size cap (videos are bigger than photos).
--
--    Part B — Custom domain activation (custom_domains stub → live)
--      • verification_token + verified_at columns
--      • RLS write policies so an artist can add / verify / remove their own row
--      • resolve_custom_domain(host) SECURITY DEFINER lookup for edge middleware
--        (anon-safe: returns only the mapped username of a verified domain)
--
--    Part C — Business-intelligence dashboard (analytics_events stub → live)
--      • analytics_events_artist_insert policy so an artist (or a service-role
--        emit helper acting on their behalf) can record events.
--
--  All statements are idempotent (IF EXISTS / IF NOT EXISTS / drop-then-create).
-- ══════════════════════════════════════════════════════════════════════════════


-- ─── Part A: Video portfolio ──────────────────────────────────────────────────

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- Add the CHECK separately so re-running the migration never errors on a
-- pre-existing constraint.
ALTER TABLE public.portfolio_images
  DROP CONSTRAINT IF EXISTS portfolio_images_media_type_check;

ALTER TABLE public.portfolio_images
  ADD CONSTRAINT portfolio_images_media_type_check
  CHECK (media_type IN ('image', 'video'));

-- Optional poster / thumbnail image for video items (a still frame the browser
-- shows before playback). NULL for images and for videos without a poster.
ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS poster_url text;

-- Allow videos in the (public) portfolio-images bucket and raise the size cap
-- to 50 MB. Images remain accepted. No-op if the bucket was created via the
-- Supabase dashboard instead of migration 003.
UPDATE storage.buckets
  SET
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ],
    file_size_limit = 52428800  -- 50 MB
  WHERE id = 'portfolio-images';


-- ─── Part B: Custom domains ───────────────────────────────────────────────────

ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS verification_token text;

ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Artists may manage their OWN custom-domain row (add / verify / remove).
-- (001/002 only granted SELECT + admin ALL on this stub table.)
DROP POLICY IF EXISTS "custom_domains_artist_insert" ON public.custom_domains;
CREATE POLICY "custom_domains_artist_insert"
  ON public.custom_domains FOR INSERT
  TO authenticated
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "custom_domains_artist_update" ON public.custom_domains;
CREATE POLICY "custom_domains_artist_update"
  ON public.custom_domains FOR UPDATE
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "custom_domains_artist_delete" ON public.custom_domains;
CREATE POLICY "custom_domains_artist_delete"
  ON public.custom_domains FOR DELETE
  TO authenticated
  USING (artist_id = public.current_artist_id());

-- Edge middleware runs unauthenticated for public visitors, so it cannot read
-- custom_domains directly under RLS. This SECURITY DEFINER function exposes ONLY
-- the mapped username for a *verified* domain — nothing else about the table.
CREATE OR REPLACE FUNCTION public.resolve_custom_domain(p_host text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.username
  FROM public.custom_domains cd
  JOIN public.artists a ON a.id = cd.artist_id
  WHERE cd.domain = lower(p_host)
    AND cd.verified = true
    AND a.deleted_at IS NULL
    AND a.onboarding_complete = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_custom_domain(text) TO anon, authenticated;


-- ─── Part C: Analytics events ─────────────────────────────────────────────────

-- Let an artist record their own analytics events. Server-side emit helpers that
-- use the service role bypass RLS entirely; this policy covers user-context
-- inserts and keeps writes scoped to the acting artist.
DROP POLICY IF EXISTS "analytics_events_artist_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_artist_insert"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (artist_id = public.current_artist_id());
