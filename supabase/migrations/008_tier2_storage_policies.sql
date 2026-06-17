-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 008: Tier 2 Storage Buckets & Policies
--
--  Two buckets:
--    completed-work  (PRIVATE) — Artist uploads of finished tattoo photos.
--                                Path convention: completed-work/{booking_id}/{filename}
--    review-photos   (PUBLIC)  — Client-uploaded photos attached to a review.
--                                Path convention: review-photos/{booking_id}/{filename}
--                                Public because approved reviews are shown
--                                publicly on the artist page (matches
--                                portfolio-images' public-read pattern).
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'completed-work',
    'completed-work',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'review-photos',
    'review-photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ══════════════════════════════════════════════════════════════════════════════
--  COMPLETED-WORK  (PRIVATE BUCKET)
--
--  Artist-only write, scoped to their own bookings. Read access for the
--  artist's dashboard is via signed URL (service role); the public page only
--  ever displays the photo URL stored on an *approved* review row.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "completed_work_artist_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'completed-work'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.artists a ON a.id = b.artist_id
      WHERE a.user_id = auth.uid()
        AND a.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND (storage.foldername(name))[1] = b.id::text
    )
  );

CREATE POLICY "completed_work_artist_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'completed-work'
    AND owner = auth.uid()
  );

CREATE POLICY "completed_work_artist_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'completed-work'
    AND owner = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════════════
--  REVIEW-PHOTOS  (PUBLIC BUCKET)
--
--  Uploaded by anonymous clients via the token-gated review submission route,
--  which uses the service role (bypasses RLS) — matching the booking_holds
--  / reference-images write pattern. No anon INSERT policy is defined.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "review_photos_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-photos');
