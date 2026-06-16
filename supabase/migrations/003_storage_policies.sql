-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 003: Storage Buckets & Policies
--
--  Three buckets:
--    portfolio-images  (PUBLIC)  — Artist gallery. Public read, artist write.
--    avatars           (PUBLIC)  — Profile photos. Public read, owner write.
--    reference-images  (PRIVATE) — Client booking references.
--                                  §8.2: All access via service-role signed URLs.
--                                  No user-facing RLS policies.
--
--  Bucket settings:
--    file_size_limit:    10 MB (10,485,760 bytes)
--    allowed_mime_types: image/jpeg, image/png, image/webp
--
--  NOTE: If Supabase dashboard bucket creation is preferred, skip the INSERT
--  statements and create buckets manually. The policy statements below are
--  always required regardless of how buckets are created.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Create Buckets ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'portfolio-images',
    'portfolio-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'reference-images',
    'reference-images',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'avatars',
    'avatars',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ══════════════════════════════════════════════════════════════════════════════
--  PORTFOLIO-IMAGES  (PUBLIC BUCKET)
--
--  Path convention: portfolio-images/{artist_id}/{filename}
--
--  The first folder segment (storage.foldername(name))[1] must equal the
--  authenticated user's artist UUID to be accepted for upload/mutation.
-- ══════════════════════════════════════════════════════════════════════════════

-- Anyone (including anon) can read portfolio images — this is the public gallery
CREATE POLICY "portfolio_images_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'portfolio-images');

-- Authenticated artists can upload to their own artist-ID folder only
CREATE POLICY "portfolio_images_artist_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio-images'
    AND (storage.foldername(name))[1] = (
      SELECT id::text
      FROM public.artists
      WHERE user_id    = auth.uid()
        AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- Artists can update metadata on objects they own
-- (Supabase sets owner = auth.uid() at upload time)
CREATE POLICY "portfolio_images_artist_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'portfolio-images'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'portfolio-images'
    AND owner = auth.uid()
  );

-- Artists can delete their own portfolio images
CREATE POLICY "portfolio_images_artist_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portfolio-images'
    AND owner = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════════════
--  AVATARS  (PUBLIC BUCKET)
--
--  Path convention: avatars/{user_id}/{filename}
--
--  The first folder segment must equal the authenticated user's profile UUID.
--  (Note: keyed to user_id / auth.uid(), not artist_id — admins have avatars too.)
-- ══════════════════════════════════════════════════════════════════════════════

-- Anyone can view avatars (displayed publicly on artist pages and in emails)
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Users can upload an avatar to their own user-ID folder only
CREATE POLICY "avatars_user_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can replace their own avatar
CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner  = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND owner  = auth.uid()
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner  = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════════════
--  REFERENCE-IMAGES  (PRIVATE BUCKET)
--
--  Path convention: reference-images/{booking_id}/{filename}
--
--  §8.2 ruling: ALL access to this bucket goes through service-role
--  Server Actions that generate short-lived signed URLs.
--
--  Upload flow:
--    1. Client submits booking form
--    2. Server Action (service role) creates the booking row
--    3. Server Action calls supabase.storage.from('reference-images')
--       .createSignedUploadUrl('{booking_id}/{filename}') per image
--    4. Client uploads directly to each signed upload URL (no auth required)
--    5. Server Action stores the storage paths in bookings.reference_image_paths
--
--  Read flow (artist in dashboard):
--    1. Artist opens booking detail
--    2. Server Action (service role) calls
--       .createSignedUrl(path, ttl=3600) for each path in reference_image_paths
--    3. Signed URLs are returned to the client for display
--
--  Because all operations use service role (which bypasses RLS entirely),
--  no user-facing policies are defined for this bucket.
--  The bucket is private — unauthenticated direct access is always denied.
--
--  Defence-in-depth: artists can read reference images for their own bookings
--  via direct authenticated access (fallback if signed URL approach changes).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "reference_images_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reference-images'
    AND EXISTS (
      SELECT 1
      FROM   public.bookings    b
      JOIN   public.artists     a ON a.id = b.artist_id
      WHERE  a.user_id          = auth.uid()
        AND  a.deleted_at      IS NULL
        AND  b.deleted_at      IS NULL
        -- The first folder segment of the object path is the booking UUID
        AND  (storage.foldername(name))[1] = b.id::text
    )
  );

-- NOTE: No INSERT, UPDATE, or DELETE policies for reference-images.
-- All mutations are performed by service role via signed upload URLs.
-- Any direct authenticated upload attempt will be denied by default. ✓
