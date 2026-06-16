-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 002: Row Level Security Policies
--
--  Design principles:
--    1. Every table has RLS enabled — deny by default.
--    2. Helper functions use SECURITY DEFINER + SET search_path to prevent
--       infinite recursion when RLS on table X calls a function that queries
--       table X (e.g. is_admin() reads profiles, which has RLS).
--    3. §3.3 ruling — no anon or authenticated INSERT on bookings or
--       booking_holds via RLS. All writes go through service-role Server
--       Actions. RLS absence on INSERT = deny for non-service-role callers.
--    4. §3.2 ruling — client status view uses access_token looked up by a
--       service-role API route. No RLS policy needed for that path.
--    5. Admin users bypass all per-user scoping via is_admin() check.
--    6. Stub tables (custom_domains, analytics_events) get minimal policies
--       so plan-gating reads work without exposing writes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Helper Functions ─────────────────────────────────────────────────────────
--
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS on
-- the tables being queried. This prevents the recursive deadlock:
--   "Evaluate RLS on profiles" → calls is_admin() → queries profiles → repeat.
--
-- SET search_path = public: prevents search_path hijacking (CWE-1287).

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

-- ══════════════════════════════════════════════════════════════════════════════
--  PROFILES
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (name, avatar, etc.)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins have full access to all profiles
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTE: No INSERT policy — profiles are created by the handle_new_user()
-- trigger running as service role, not by user-initiated RLS writes.
-- NOTE: No DELETE policy — soft-delete only, performed by service role.

-- ══════════════════════════════════════════════════════════════════════════════
--  SUBSCRIPTIONS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription to check plan limits
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all subscriptions
CREATE POLICY "subscriptions_admin_all"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTE: No INSERT or UPDATE policies for regular users.
-- subscriptions are created by handle_new_profile() trigger (service role)
-- and updated exclusively by the Stripe webhook handler (service role).

-- ══════════════════════════════════════════════════════════════════════════════
--  ARTISTS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Public (including anon): read any fully onboarded, non-deleted artist.
-- Powers /a/{username} page lookups without requiring auth.
CREATE POLICY "artists_public_select"
  ON public.artists FOR SELECT
  TO public
  USING (onboarding_complete = true AND deleted_at IS NULL);

-- Authenticated users can always read their own artist profile
-- (needed during onboarding before onboarding_complete = true)
CREATE POLICY "artists_select_own"
  ON public.artists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Artists can create their own artist profile during onboarding step 1
CREATE POLICY "artists_insert_own"
  ON public.artists FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Artists can update their own profile (bio, availability, site_data, etc.)
CREATE POLICY "artists_update_own"
  ON public.artists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- Admins have full access
CREATE POLICY "artists_admin_all"
  ON public.artists FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTE: No DELETE policy — soft-delete only, performed by service role.

-- ══════════════════════════════════════════════════════════════════════════════
--  PORTFOLIO IMAGES
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;

-- Public: read portfolio images of any onboarded, non-deleted artist
CREATE POLICY "portfolio_images_public_select"
  ON public.portfolio_images FOR SELECT
  TO public
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = portfolio_images.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

-- Artists can manage their own portfolio images
CREATE POLICY "portfolio_images_artist_insert"
  ON public.portfolio_images FOR INSERT
  TO authenticated
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "portfolio_images_artist_update"
  ON public.portfolio_images FOR UPDATE
  TO authenticated
  USING (
    artist_id = public.current_artist_id()
    AND deleted_at IS NULL
  )
  WITH CHECK (artist_id = public.current_artist_id());

-- Soft-delete only (set deleted_at); artist can update their own
CREATE POLICY "portfolio_images_artist_softdelete"
  ON public.portfolio_images FOR UPDATE
  TO authenticated
  USING (artist_id = public.current_artist_id());

CREATE POLICY "portfolio_images_admin_all"
  ON public.portfolio_images FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  ARTIST AVAILABILITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;

-- Public: read availability for any onboarded artist
-- Powers the booking calendar on /a/{username} without auth
CREATE POLICY "artist_availability_public_select"
  ON public.artist_availability FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_availability.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

-- Artists manage their own availability schedule
CREATE POLICY "artist_availability_artist_all"
  ON public.artist_availability FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "artist_availability_admin_all"
  ON public.artist_availability FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  BLOCKED DATES
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

-- Public: read blocked dates for any onboarded artist (for calendar display)
CREATE POLICY "blocked_dates_public_select"
  ON public.blocked_dates FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = blocked_dates.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

-- Artists manage their own blocked dates
CREATE POLICY "blocked_dates_artist_all"
  ON public.blocked_dates FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "blocked_dates_admin_all"
  ON public.blocked_dates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  CLIENTS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Artists can manage only their own clients
CREATE POLICY "clients_artist_all"
  ON public.clients FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

CREATE POLICY "clients_admin_all"
  ON public.clients FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTE: No anon or public access. Clients belong to the artist, not
-- accessible to the booking client (by email/session) without auth.

-- ══════════════════════════════════════════════════════════════════════════════
--  BOOKINGS
--
--  §3.3 ruling: ZERO INSERT policies for non-service-role principals.
--  All booking creation goes through Server Actions using the service role
--  Supabase client, which bypasses RLS entirely.
--
--  §3.2 ruling: Client status lookup uses access_token via a service-role
--  API route (/api/booking/[token]/status). No RLS policy needed for that
--  path because service role bypasses RLS.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Artists can read all bookings for their own profile (dashboard, calendar)
CREATE POLICY "bookings_artist_select"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    artist_id = public.current_artist_id()
    AND deleted_at IS NULL
  );

-- Artists can update their own bookings:
-- - Confirm pending bookings (status: pending → confirmed)
-- - Mark completed or no-show (status: confirmed/deposit_paid → completed/no_show)
-- - Add internal notes
-- - Soft-cancel (status: * → cancelled)
-- Application layer enforces valid status transitions.
CREATE POLICY "bookings_artist_update"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    artist_id = public.current_artist_id()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    artist_id = public.current_artist_id()
  );

-- Admins have full access (support, refunds, compliance)
CREATE POLICY "bookings_admin_all"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  BOOKING HOLDS
--
--  §3.3 ruling: No INSERT via RLS — created by service-role Server Action.
--  Artists can read holds for their calendar view.
--  Artists can delete holds (manual slot release from dashboard).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

-- Artists can see holds on their slots (for calendar "tentative" display)
CREATE POLICY "booking_holds_artist_select"
  ON public.booking_holds FOR SELECT
  TO authenticated
  USING (
    artist_id = public.current_artist_id()
    AND expires_at > NOW()
  );

-- Artists can manually release holds (e.g. if client calls to cancel enquiry)
CREATE POLICY "booking_holds_artist_delete"
  ON public.booking_holds FOR DELETE
  TO authenticated
  USING (artist_id = public.current_artist_id());

CREATE POLICY "booking_holds_admin_all"
  ON public.booking_holds FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  STRIPE EVENTS
--  Admin-only SELECT. All writes via service role (webhook handler).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_events_admin_all"
  ON public.stripe_events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  EMAIL LOGS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own email history (subscription receipts, GDPR emails)
CREATE POLICY "email_logs_select_own"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "email_logs_admin_all"
  ON public.email_logs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  AUDIT LOGS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own audit trail (GDPR data access request)
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit_logs_admin_all"
  ON public.audit_logs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  CUSTOM DOMAINS  [STUB]
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- Artists can read their own custom domain stub
-- (to show "coming soon" state in dashboard)
CREATE POLICY "custom_domains_artist_select"
  ON public.custom_domains FOR SELECT
  TO authenticated
  USING (
    artist_id = public.current_artist_id()
  );

CREATE POLICY "custom_domains_admin_all"
  ON public.custom_domains FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════════
--  ANALYTICS EVENTS  [STUB]
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Artists can read their own analytics stub data
CREATE POLICY "analytics_events_artist_select"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (artist_id = public.current_artist_id());

CREATE POLICY "analytics_events_admin_all"
  ON public.analytics_events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
