-- ============================================================================
--  InkDesk — RLS repair script (idempotent)
--
--  Paste this whole file into Supabase → SQL Editor → Run.
--
--  It (re)installs the row-level-security helper functions and table policies
--  from migration 002. Safe to run multiple times: functions use CREATE OR
--  REPLACE and every policy is dropped-if-exists before being recreated.
--
--  This is the durable fix for the "new row violates row-level security
--  policy" / "Update failed" errors — those happen when current_artist_id()
--  or the policies below are missing from the database.
--
--  If a statement errors with 'relation "public.X" does not exist', that table
--  isn't in your schema yet — delete that table's section and re-run. All
--  tables referenced here come from the base schema (migration 001).
-- ============================================================================

-- ── Helper functions (SECURITY DEFINER, fixed search_path) ──────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role = 'admin'
      FROM public.profiles
      WHERE id = auth.uid()
        AND deleted_at IS NULL
    ),
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
  SELECT id
  FROM public.artists
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- ── PROFILES ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_all"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── ARTISTS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artists_public_select" ON public.artists;
CREATE POLICY "artists_public_select"
  ON public.artists FOR SELECT TO public
  USING (onboarding_complete = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "artists_select_own" ON public.artists;
CREATE POLICY "artists_select_own"
  ON public.artists FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "artists_insert_own" ON public.artists;
CREATE POLICY "artists_insert_own"
  ON public.artists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "artists_update_own" ON public.artists;
CREATE POLICY "artists_update_own"
  ON public.artists FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "artists_admin_all" ON public.artists;
CREATE POLICY "artists_admin_all"
  ON public.artists FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PORTFOLIO IMAGES ────────────────────────────────────────────────────────
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_images_public_select" ON public.portfolio_images;
CREATE POLICY "portfolio_images_public_select"
  ON public.portfolio_images FOR SELECT TO public
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = portfolio_images.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "portfolio_images_artist_insert" ON public.portfolio_images;
CREATE POLICY "portfolio_images_artist_insert"
  ON public.portfolio_images FOR INSERT TO authenticated
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "portfolio_images_artist_update" ON public.portfolio_images;
CREATE POLICY "portfolio_images_artist_update"
  ON public.portfolio_images FOR UPDATE TO authenticated
  USING (artist_id = public.current_artist_id() AND deleted_at IS NULL)
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "portfolio_images_artist_softdelete" ON public.portfolio_images;
CREATE POLICY "portfolio_images_artist_softdelete"
  ON public.portfolio_images FOR UPDATE TO authenticated
  USING (artist_id = public.current_artist_id());

-- Allow artists to hard-delete their own portfolio rows (the dashboard /
-- onboarding "remove image" action). The original schema only had soft-delete.
DROP POLICY IF EXISTS "portfolio_images_artist_delete" ON public.portfolio_images;
CREATE POLICY "portfolio_images_artist_delete"
  ON public.portfolio_images FOR DELETE TO authenticated
  USING (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "portfolio_images_admin_all" ON public.portfolio_images;
CREATE POLICY "portfolio_images_admin_all"
  ON public.portfolio_images FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── ARTIST AVAILABILITY ─────────────────────────────────────────────────────
ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_availability_public_select" ON public.artist_availability;
CREATE POLICY "artist_availability_public_select"
  ON public.artist_availability FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_availability.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "artist_availability_artist_all" ON public.artist_availability;
CREATE POLICY "artist_availability_artist_all"
  ON public.artist_availability FOR ALL TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "artist_availability_admin_all" ON public.artist_availability;
CREATE POLICY "artist_availability_admin_all"
  ON public.artist_availability FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── BLOCKED DATES ───────────────────────────────────────────────────────────
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_dates_public_select" ON public.blocked_dates;
CREATE POLICY "blocked_dates_public_select"
  ON public.blocked_dates FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = blocked_dates.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "blocked_dates_artist_all" ON public.blocked_dates;
CREATE POLICY "blocked_dates_artist_all"
  ON public.blocked_dates FOR ALL TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "blocked_dates_admin_all" ON public.blocked_dates;
CREATE POLICY "blocked_dates_admin_all"
  ON public.blocked_dates FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── CLIENTS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_artist_all" ON public.clients;
CREATE POLICY "clients_artist_all"
  ON public.clients FOR ALL TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "clients_admin_all" ON public.clients;
CREATE POLICY "clients_admin_all"
  ON public.clients FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── BOOKINGS ────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_artist_select" ON public.bookings;
CREATE POLICY "bookings_artist_select"
  ON public.bookings FOR SELECT TO authenticated
  USING (artist_id = public.current_artist_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "bookings_artist_update" ON public.bookings;
CREATE POLICY "bookings_artist_update"
  ON public.bookings FOR UPDATE TO authenticated
  USING (artist_id = public.current_artist_id() AND deleted_at IS NULL)
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;
CREATE POLICY "bookings_admin_all"
  ON public.bookings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── BOOKING HOLDS ───────────────────────────────────────────────────────────
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_holds_artist_select" ON public.booking_holds;
CREATE POLICY "booking_holds_artist_select"
  ON public.booking_holds FOR SELECT TO authenticated
  USING (artist_id = public.current_artist_id() AND expires_at > NOW());

DROP POLICY IF EXISTS "booking_holds_artist_delete" ON public.booking_holds;
CREATE POLICY "booking_holds_artist_delete"
  ON public.booking_holds FOR DELETE TO authenticated
  USING (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "booking_holds_admin_all" ON public.booking_holds;
CREATE POLICY "booking_holds_admin_all"
  ON public.booking_holds FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── EMAIL LOGS ──────────────────────────────────────────────────────────────
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_select_own" ON public.email_logs;
CREATE POLICY "email_logs_select_own"
  ON public.email_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "email_logs_admin_all" ON public.email_logs;
CREATE POLICY "email_logs_admin_all"
  ON public.email_logs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── AUDIT LOGS ──────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all"
  ON public.audit_logs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Done. Re-run any time — it's idempotent.
