-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 022: Scheduling flexibility, services, projects, iCal feed
--
--  Additive & non-destructive. Extends the single-artist booking model with:
--    1. Multiple availability windows per weekday + buffer/setup time
--    2. A `services` catalogue (per-service duration + price)
--    3. Multi-session `booking_projects` (+ project_id/session_number on bookings)
--    4. A self-contained iCal calendar feed token on artists
--
--  Follows the conventions established in 001–021:
--    - public.current_artist_id() / public.is_admin() RLS helpers
--    - RLS enabled on every new table, deny-by-default
--    - public SELECT gated on onboarding_complete = true AND deleted_at IS NULL
--    - shared trigger_set_updated_at() for updated_at maintenance
--  All statements are idempotent (IF EXISTS / IF NOT EXISTS).
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 1a — Multiple availability windows per weekday
--
--  001 added CONSTRAINT unique_artist_day UNIQUE (artist_id, day_of_week), which
--  caps each day at one window. Drop it so an artist can hold several windows for
--  the same weekday (e.g. 09:00–12:00 and 14:00–18:00). The chk_availability_window
--  CHECK (end_time > start_time) stays in force. Slot generation dedupes overlaps.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artist_availability
  DROP CONSTRAINT IF EXISTS unique_artist_day;

-- Hot-path lookup: all windows for one artist on one weekday.
CREATE INDEX IF NOT EXISTS artist_availability_artist_day_idx
  ON public.artist_availability (artist_id, day_of_week);


-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 1b — Buffer / setup time between appointments
--
--  Minutes of gap the slot generator keeps clear on both sides of an occupied
--  range, so back-to-back bookings leave time to set up / clean down.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240);


-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 3 — Self-contained iCal calendar feed token
--
--  Unguessable token embedded in a public /api/calendar/{token} URL. Lets the
--  artist subscribe to their upcoming bookings in Google/Apple Calendar with no
--  OAuth (one-way sync — prevents personal double-booking).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS calendar_feed_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Unique + fast token → artist lookup for the feed route.
CREATE UNIQUE INDEX IF NOT EXISTS artists_calendar_feed_token_idx
  ON public.artists (calendar_feed_token);


-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 1c — SERVICES
--
--  Per-artist catalogue of bookable services with their own duration and price.
--  Public booking flow can request a service so slot length matches the work.
--  Mirrors portfolio_images / artist_faqs public exposure (active + onboarded).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.services (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         uuid         NOT NULL
                                  REFERENCES public.artists(id) ON DELETE CASCADE,
  name              text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  duration_minutes  integer      NOT NULL DEFAULT 60
                                  CHECK (duration_minutes > 0 AND duration_minutes <= 960),
  price_pence       integer      CHECK (price_pence >= 0),
  active            boolean      NOT NULL DEFAULT true,
  sort_order        integer      NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT NOW(),
  updated_at        timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_artist_idx
  ON public.services (artist_id, sort_order);

DROP TRIGGER IF EXISTS set_services_updated_at ON public.services;
CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Public: read active services of any onboarded, non-deleted artist.
DROP POLICY IF EXISTS "services_public_select" ON public.services;
CREATE POLICY "services_public_select"
  ON public.services FOR SELECT
  TO public
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = services.artist_id
        AND a.onboarding_complete = true
        AND a.deleted_at IS NULL
    )
  );

-- Artists manage their own services (including inactive ones).
DROP POLICY IF EXISTS "services_artist_all" ON public.services;
CREATE POLICY "services_artist_all"
  ON public.services FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "services_admin_all" ON public.services;
CREATE POLICY "services_admin_all"
  ON public.services FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════════
--  Feature 2 — MULTI-SESSION PROJECTS
--
--  Groups several bookings into one client project (e.g. a sleeve over 4 sittings).
--  Artist-owned only — never publicly exposed.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.booking_projects (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  client_id       uuid         REFERENCES public.clients(id) ON DELETE SET NULL,
  title           text         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description     text         CHECK (char_length(description) <= 2000),
  total_sessions  integer      CHECK (total_sessions IS NULL OR (total_sessions >= 1 AND total_sessions <= 100)),
  status          text         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  updated_at      timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_projects_artist_idx
  ON public.booking_projects (artist_id, status);

CREATE INDEX IF NOT EXISTS booking_projects_client_idx
  ON public.booking_projects (client_id)
  WHERE client_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_booking_projects_updated_at ON public.booking_projects;
CREATE TRIGGER set_booking_projects_updated_at
  BEFORE UPDATE ON public.booking_projects
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.booking_projects ENABLE ROW LEVEL SECURITY;

-- Artists manage only their own projects. No public access.
DROP POLICY IF EXISTS "booking_projects_artist_all" ON public.booking_projects;
CREATE POLICY "booking_projects_artist_all"
  ON public.booking_projects FOR ALL
  TO authenticated
  USING (artist_id = public.current_artist_id())
  WITH CHECK (artist_id = public.current_artist_id());

DROP POLICY IF EXISTS "booking_projects_admin_all" ON public.booking_projects;
CREATE POLICY "booking_projects_admin_all"
  ON public.booking_projects FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── Link bookings to a project (nullable — existing single bookings unaffected) ──
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.booking_projects(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_number integer
    CHECK (session_number IS NULL OR session_number >= 1);

CREATE INDEX IF NOT EXISTS bookings_project_idx
  ON public.bookings (project_id)
  WHERE project_id IS NOT NULL;


-- Reload PostgREST schema cache so the new columns/tables are queryable at once.
NOTIFY pgrst, 'reload schema';
