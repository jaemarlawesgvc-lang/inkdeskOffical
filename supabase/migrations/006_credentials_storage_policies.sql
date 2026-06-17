-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 006: Credentials Storage Bucket & Policies
--
--  Bucket: credentials (PRIVATE)
--    Path convention: credentials/{artist_id}/{filename}
--    Holds: license documents (PDF/image), award images.
--
--  Privacy: license documents must never be exposed publicly — the public
--  artist page only shows a "Licensed" badge (derived from
--  artist_credentials rows, see 005), never the file itself. Award images
--  are also stored here but served via short-lived signed URLs requested
--  by the public page's server-side data loader, matching the existing
--  reference-images bucket pattern.
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credentials',
  'credentials',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Artists can upload to their own artist-ID folder only
CREATE POLICY "credentials_artist_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'credentials'
    AND (storage.foldername(name))[1] = (
      SELECT id::text
      FROM public.artists
      WHERE user_id    = auth.uid()
        AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- Artists can read their own credential files (dashboard management view)
CREATE POLICY "credentials_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND owner  = auth.uid()
  );

-- Artists can replace their own credential files
CREATE POLICY "credentials_artist_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND owner  = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'credentials'
    AND owner  = auth.uid()
  );

-- Artists can delete their own credential files
CREATE POLICY "credentials_artist_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND owner  = auth.uid()
  );

-- NOTE: No public SELECT policy. Award images shown publicly are served via
-- service-role signed URLs generated server-side (createSignedUrl), matching
-- the reference-images pattern in 003_storage_policies.sql. Direct anonymous
-- access to this bucket is always denied.
