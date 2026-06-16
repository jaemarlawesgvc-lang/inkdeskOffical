-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 001: Initial Schema
--
--  Incorporates all Phase 0 structural fixes:
--    §2.1  Per-slot booking model with btree_gist exclusion constraint
--    §2.2  Stripe Connect destination charges (stripe_connect_account_id)
--    §2.7  years_experience on artists
--    §2.8  Stripe price IDs (in env, not schema; stub comment for reference)
--    §3.2  High-entropy access_token on bookings for client status view
--    §3.3  No anon write policies (enforced in 002_rls_policies.sql)
--    §5.5  Soft-delete partial unique indexes on username and email
--    §8.1  client_id FK on bookings; UNIQUE(artist_id, email) on clients
--    §8.2  reference_image_paths stores storage PATHS, not signed URLs
--
--  Deferred features have stub tables only:
--    custom_domains   — Studio plan, v2
--    analytics_events — Pro+ plan, v2
-- ══════════════════════════════════════════════════════════════════════════════


-- ─── Extensions ───────────────────────────────────────────────────────────────


-- Required for gen_random_uuid() on older PostgreSQL versions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Required for the per-slot overlap EXCLUDE constraint (§2.1).
-- btree_gist allows mixing non-range types (e.g. uuid with =) in GiST indexes.
CREATE EXTENSION IF NOT EXISTS "btree_gist";


-- ─── Shared: updated_at Auto-Maintenance ──────────────────────────────────────


CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════════════════
--  PROFILES
--  One row per auth.users entry. Created automatically by handle_new_user().
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.profiles (
  -- PK is the auth.users UUID — intentional exception to gen_random_uuid() rule
  id                   uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text         NOT NULL,
  full_name            text,
  avatar_url           text,
  role                 text         NOT NULL DEFAULT 'artist'
                                    CHECK (role IN ('artist', 'admin')),
  -- Stripe Customer ID for subscription billing (denormalised on subscriptions too
  -- for fast webhook lookup — keep in sync via subscription creation server action)
  stripe_customer_id   text         UNIQUE,
  created_at           timestamptz  NOT NULL DEFAULT NOW(),
  updated_at           timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at           timestamptz
);


-- §5.5 — Partial unique index: email is unique only among non-deleted profiles.
-- Allows the same email to be reused after a GDPR deletion (soft-delete).
CREATE UNIQUE INDEX profiles_email_unique_active
  ON public.profiles (email)
  WHERE deleted_at IS NULL;


CREATE INDEX profiles_stripe_customer_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- Auto-create a profile row whenever a new auth.users row is inserted.
-- Handles both email/password signup and OAuth (Google uses `name` + `picture`).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'email'),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════════════════════
--  SUBSCRIPTIONS
--  One row per user. Created automatically by handle_new_profile().
--  All mutations via service role from Stripe webhook handler.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.subscriptions (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid         NOT NULL UNIQUE
                                        REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id    text         UNIQUE,
  -- Denormalised from profiles.stripe_customer_id for fast webhook processing
  stripe_customer_id        text,
  plan                      text         NOT NULL DEFAULT 'free'
                                        CHECK (plan IN ('free', 'pro', 'studio')),
  status                    text         NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean      NOT NULL DEFAULT false,
  created_at                timestamptz  NOT NULL DEFAULT NOW(),
  updated_at                timestamptz  NOT NULL DEFAULT NOW()
);


CREATE INDEX subscriptions_stripe_sub_idx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;


CREATE INDEX subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- Auto-create a free subscription row whenever a profile is created.
-- The upsert pattern (ON CONFLICT DO NOTHING) is safe for out-of-order events.
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();


-- ══════════════════════════════════════════════════════════════════════════════
--  ARTISTS
--  Artist profile, created during onboarding step 1–5.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.artists (
  id                           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1-to-1 with profiles; NOT NULL UNIQUE enforces the relationship
  user_id                      uuid          NOT NULL UNIQUE
                                            REFERENCES public.profiles(id) ON DELETE CASCADE,
  username                     text          NOT NULL
                                            CHECK (char_length(username) BETWEEN 3 AND 30),
  display_name                 text          CHECK (char_length(display_name) <= 60),
  bio                          text          CHECK (char_length(bio) <= 500),
  style_tags                   text[]        NOT NULL DEFAULT '{}',
  -- §2.7 — years of tattooing experience (optional, self-reported)
  years_experience             integer       CHECK (years_experience >= 0 AND years_experience <= 60),
  hourly_rate                  numeric(10,2) CHECK (hourly_rate >= 0),
  deposit_amount               numeric(10,2) CHECK (deposit_amount >= 0),
  deposit_required             boolean       NOT NULL DEFAULT true,
  studio_name                  text,
  studio_address               text,
  -- Artist's local IANA timezone (e.g. 'Europe/London') for reminder scheduling
  timezone                     text          NOT NULL DEFAULT 'Europe/London',
  instagram_handle             text,
  website_url                  text,


  -- §2.2 — Stripe Connect for artist payouts (Destination Charges model)
  stripe_connect_account_id    text          UNIQUE,
  stripe_connect_onboarded     boolean       NOT NULL DEFAULT false,


  -- AI-generated site configuration
  site_generated               boolean       NOT NULL DEFAULT false,
  site_data                    jsonb,


  -- Onboarding state machine (5 steps)
  onboarding_complete          boolean       NOT NULL DEFAULT false,
  onboarding_step              integer       NOT NULL DEFAULT 1
                                            CHECK (onboarding_step BETWEEN 1 AND 5),


  created_at                   timestamptz   NOT NULL DEFAULT NOW(),
  updated_at                   timestamptz   NOT NULL DEFAULT NOW(),
  deleted_at                   timestamptz
);


-- §5.5 — Username unique only among non-deleted artists.
-- Freed username can be re-registered after account deletion.
CREATE UNIQUE INDEX artists_username_unique_active
  ON public.artists (username)
  WHERE deleted_at IS NULL;


-- Public page lookup: /a/{username}
CREATE INDEX artists_username_public_idx
  ON public.artists (username)
  WHERE onboarding_complete = true AND deleted_at IS NULL;


CREATE INDEX artists_user_id_idx
  ON public.artists (user_id)
  WHERE deleted_at IS NULL;


CREATE INDEX artists_stripe_connect_idx
  ON public.artists (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;


CREATE TRIGGER set_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
--  PORTFOLIO IMAGES
--  Ordered gallery for the public artist page. Public bucket — URL stored.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.portfolio_images (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid         NOT NULL
                                REFERENCES public.artists(id) ON DELETE CASCADE,
  -- Storage path within the portfolio-images bucket (e.g. '{artist_id}/photo.jpg')
  storage_path    text         NOT NULL,
  -- Deterministic public URL (public bucket — safe to cache)
  public_url      text         NOT NULL,
  caption         text         CHECK (char_length(caption) <= 200),
  -- Controls display order; lower = first. Updated via reorder server action.
  display_order   integer      NOT NULL DEFAULT 0,
  created_at      timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);


CREATE INDEX portfolio_images_artist_idx
  ON public.portfolio_images (artist_id, display_order)
  WHERE deleted_at IS NULL;


-- ══════════════════════════════════════════════════════════════════════════════
--  ARTIST AVAILABILITY
--  Weekly recurring schedule. One window per day of week (0=Sun … 6=Sat).
--  Stored in the artist's local timezone (from artists.timezone).
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.artist_availability (
  id             uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      uuid   NOT NULL
                        REFERENCES public.artists(id) ON DELETE CASCADE,
  -- 0 = Sunday … 6 = Saturday (ISO day-of-week - 1 for Sunday compatibility)
  day_of_week    integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     time   NOT NULL,
  end_time       time   NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW(),


  CONSTRAINT chk_availability_window CHECK (end_time > start_time),
  -- One availability window per day per artist
  CONSTRAINT unique_artist_day UNIQUE (artist_id, day_of_week)
);


CREATE TRIGGER set_artist_availability_updated_at
  BEFORE UPDATE ON public.artist_availability
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
--  BLOCKED DATES
--  One-off unavailability overrides (holidays, conventions, leave).
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.blocked_dates (
  id             uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      uuid   NOT NULL
                        REFERENCES public.artists(id) ON DELETE CASCADE,
  blocked_date   date   NOT NULL,
  reason         text   CHECK (char_length(reason) <= 200),
  created_at     timestamptz NOT NULL DEFAULT NOW(),


  CONSTRAINT unique_artist_blocked_date UNIQUE (artist_id, blocked_date)
);


CREATE INDEX blocked_dates_artist_idx
  ON public.blocked_dates (artist_id, blocked_date);


-- ══════════════════════════════════════════════════════════════════════════════
--  CLIENTS
--  §8.1 fix — client_id FK on bookings; UNIQUE(artist_id, email).
--  One record per unique email per artist. Upserted at booking creation time.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.clients (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         uuid         NOT NULL
                                  REFERENCES public.artists(id) ON DELETE CASCADE,
  name              text         NOT NULL,
  email             text,
  phone             text,
  notes             text,         -- Gated to 'full' clientNotesLevel in application
  -- Denormalised stats updated by sync_client_booking_stats trigger
  booking_count     integer      NOT NULL DEFAULT 0 CHECK (booking_count >= 0),
  last_booking_at   timestamptz,
  created_at        timestamptz  NOT NULL DEFAULT NOW(),
  updated_at        timestamptz  NOT NULL DEFAULT NOW(),


  -- §8.1 — One client record per (artist, email) pair enables reliable upsert
  CONSTRAINT unique_client_per_artist_email UNIQUE (artist_id, email)
);


CREATE INDEX clients_artist_idx
  ON public.clients (artist_id);


CREATE INDEX clients_email_idx
  ON public.clients (email)
  WHERE email IS NOT NULL;


CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
--  BOOKINGS
--  Core booking record incorporating all Phase 0 approved decisions:
--    §2.1  Per-slot model: booking_time + duration_hours (not per-day)
--    §3.2  access_token for unauthenticated client status view
--    §8.1  client_id FK to clients table
--    §8.2  reference_image_paths stores PATHS not URLs (private bucket)
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.bookings (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id               uuid          NOT NULL
                                        REFERENCES public.artists(id) ON DELETE RESTRICT,
  -- §8.1 — FK to clients; SET NULL on client deletion (preserves booking history)
  client_id               uuid
                                        REFERENCES public.clients(id) ON DELETE SET NULL,


  -- ── Client info (denormalised for access without auth) ────────────────────
  client_name             text          NOT NULL,
  client_email            text          NOT NULL,
  client_phone            text,


  -- ── Per-slot schedule (§2.1 ruling) ──────────────────────────────────────
  -- Date and time stored as artist's LOCAL time (relative to artists.timezone).
  -- The exclusion constraint enforces no overlapping confirmed/paid slots.
  booking_date            date          NOT NULL,
  booking_time            time          NOT NULL,
  duration_hours          numeric(4,2)  NOT NULL DEFAULT 1.0
                                        CHECK (duration_hours > 0 AND duration_hours <= 16),


  -- ── Description & Reference Images ───────────────────────────────────────
  description             text          CHECK (
                                          char_length(description) BETWEEN 10 AND 1000
                                        ),
  -- §8.2 — Stores storage PATHS within the private 'reference-images' bucket,
  -- NOT signed URLs. Signed read URLs are generated on demand via service role.
  -- Format: ARRAY['{booking_id}/photo1.jpg', '{booking_id}/photo2.png']
  reference_image_paths   text[]        NOT NULL DEFAULT '{}',


  -- ── Status Machine ────────────────────────────────────────────────────────
  -- All bookings begin as 'pending' (§3 ruling: manual artist confirmation).
  -- No-deposit bookings stay pending until artist clicks Confirm in dashboard.
  -- Deposit bookings move to 'deposit_paid' after Stripe capture succeeds.
  status                  text          NOT NULL DEFAULT 'pending'
                                        CHECK (status IN (
                                          'pending', 'confirmed', 'deposit_paid',
                                          'completed', 'cancelled', 'no_show'
                                        )),


  -- ── Payment ───────────────────────────────────────────────────────────────
  deposit_amount          numeric(10,2) CHECK (deposit_amount >= 0),
  deposit_paid            boolean       NOT NULL DEFAULT false,
  total_amount            numeric(10,2) CHECK (total_amount >= 0),
  -- Stripe PaymentIntent ID; initially created with capture_method='manual'
  stripe_payment_intent_id text,
  stripe_payment_status    text,


  -- ── Internal ──────────────────────────────────────────────────────────────
  notes                   text,


  -- §3.2 — High-entropy token used in the unauthenticated client status link.
  -- Client receives: inkdesk.co/booking/{access_token}/status
  -- Looked up via service-role API route; no RLS policy required.
  access_token            uuid          NOT NULL DEFAULT gen_random_uuid(),


  created_at              timestamptz   NOT NULL DEFAULT NOW(),
  updated_at              timestamptz   NOT NULL DEFAULT NOW(),
  deleted_at              timestamptz
);


-- ── Per-slot Overlap Prevention (§2.1 — core booking integrity guarantee) ────
--
-- Uses PostgreSQL EXCLUDE to atomically prevent two confirmed/paid bookings
-- from occupying overlapping time ranges for the same artist.
--
-- Why btree_gist: artist_id is a UUID (non-range type). btree_gist allows
-- mixing = (equality) and && (range overlap) operators in one GiST index.
--
-- Half-open interval '[)' means [start, end) so adjacent slots (e.g.
-- 09:00–11:00 and 11:00–13:00) do NOT conflict. ✓
--
-- The WHERE clause restricts the constraint to active, non-soft-deleted
-- bookings in occupying statuses. Pending/cancelled/completed rows can freely
-- share the same slot and are not subject to conflict checking.
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_confirmed_bookings
  EXCLUDE USING gist (
    artist_id WITH =,
    tsrange(
      (booking_date + booking_time)::timestamp,
      (booking_date + booking_time + (duration_hours * INTERVAL '1 hour'))::timestamp,
      '[)'
    ) WITH &&
  )
  WHERE (
    status IN ('confirmed', 'deposit_paid')
    AND deleted_at IS NULL
  );


-- Standard operational indexes
CREATE INDEX bookings_artist_date_idx
  ON public.bookings (artist_id, booking_date)
  WHERE deleted_at IS NULL;


CREATE INDEX bookings_status_idx
  ON public.bookings (artist_id, status)
  WHERE deleted_at IS NULL;


CREATE INDEX bookings_client_email_idx
  ON public.bookings (artist_id, client_email)
  WHERE deleted_at IS NULL;


-- §3.2 — Token lookup for client status page (no join needed)
CREATE UNIQUE INDEX bookings_access_token_idx
  ON public.bookings (access_token);


-- Webhook lookup: find booking by Stripe PaymentIntent
CREATE INDEX bookings_stripe_pi_idx
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;


CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ── Trigger: keep clients.booking_count + last_booking_at in sync ────────────
CREATE OR REPLACE FUNCTION public.sync_client_booking_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- New booking linked to a client → increment
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients
    SET
      booking_count   = booking_count + 1,
      last_booking_at = NOW(),
      updated_at      = NOW()
    WHERE id = NEW.client_id;


  -- Booking soft-deleted → decrement (floor at 0, never go negative)
  ELSIF TG_OP = 'UPDATE'
    AND OLD.client_id IS NOT NULL
    AND NEW.deleted_at IS NOT NULL
    AND OLD.deleted_at IS NULL
  THEN
    UPDATE public.clients
    SET
      booking_count = GREATEST(0, booking_count - 1),
      updated_at    = NOW()
    WHERE id = OLD.client_id;
  END IF;


  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TRIGGER sync_booking_client_stats
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_booking_stats();


-- ══════════════════════════════════════════════════════════════════════════════
--  BOOKING HOLDS
--  Advisory slot reservation while a client fills the booking form.
--  TTL: 15 minutes. The cron job /api/cron/expire-holds purges these.
--
--  IMPORTANT: Holds are advisory UX signals only.
--  The REAL atomicity guarantee lives in the bookings exclusion constraint.
--  A hold does NOT prevent another client from completing a booking for the
--  same slot — the exclusion constraint is the final arbiter.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.booking_holds (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid          NOT NULL
                                  REFERENCES public.artists(id) ON DELETE CASCADE,
  booking_date    date          NOT NULL,
  booking_time    time          NOT NULL,
  duration_hours  numeric(4,2)  NOT NULL DEFAULT 1.0
                                  CHECK (duration_hours > 0),
  expires_at      timestamptz   NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  -- Browser session identifier — used to release the hold if the client
  -- navigates away. Not a security boundary; the exclusion constraint is.
  session_id      text          NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT NOW()
);


-- Fast lookup: "is this slot held right now for this artist?"
-- NOTE: Original version used `WHERE expires_at > NOW()` which fails because
-- NOW() is not immutable. For now we comment this index out so migrations work.
-- CREATE INDEX booking_holds_artist_date_idx
--   ON public.booking_holds (artist_id, booking_date, booking_time)
--   WHERE expires_at > NOW();


-- Cron cleanup index
CREATE INDEX booking_holds_expires_idx
  ON public.booking_holds (expires_at);


CREATE INDEX booking_holds_session_idx
  ON public.booking_holds (session_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  STRIPE EVENTS
--  Idempotency store for Stripe webhook events.
--  INSERT on first receipt; UPDATE processed=true after handling.
--  The UNIQUE constraint on stripe_event_id prevents double-processing.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.stripe_events (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id   text         NOT NULL UNIQUE,   -- e.g. 'evt_1PxAbc...'
  event_type        text         NOT NULL,          -- e.g. 'payment_intent.captured'
  payload           jsonb        NOT NULL,
  processed         boolean      NOT NULL DEFAULT false,
  processed_at      timestamptz,
  error             text,
  created_at        timestamptz  NOT NULL DEFAULT NOW()
);


-- Webhook retry queue: unprocessed events
CREATE INDEX stripe_events_unprocessed_idx
  ON public.stripe_events (created_at)
  WHERE processed = false;


CREATE INDEX stripe_events_type_idx
  ON public.stripe_events (event_type);


-- ══════════════════════════════════════════════════════════════════════════════
--  EMAIL LOGS
--  Audit trail for all transactional emails.
--  The partial unique index on (booking_id, email_type) WHERE status = 'sent'
--  is the cron idempotency guard — prevents sending duplicate reminders if
--  the cron runs twice within a 24h window.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.email_logs (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid         REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id             uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_type          text         NOT NULL
                                    CHECK (email_type IN (
                                      'booking_confirmation',
                                      'artist_notification',
                                      'reminder_48h',
                                      'aftercare',
                                      'payment_failed',
                                      'subscription_cancelled',
                                      'gdpr_export',
                                      'gdpr_deletion'
                                    )),
  recipient_email     text         NOT NULL,
  resend_message_id   text,
  status              text         NOT NULL DEFAULT 'sent'
                                    CHECK (status IN ('sent', 'failed', 'skipped')),
  sent_at             timestamptz  NOT NULL DEFAULT NOW(),
  error               text
);


-- §6.4 — Cron idempotency: only one successfully sent email per (booking, type).
-- Cron checks this index before sending; if a row exists, it skips the send.
CREATE UNIQUE INDEX email_logs_idempotency_idx
  ON public.email_logs (booking_id, email_type)
  WHERE booking_id IS NOT NULL AND status = 'sent';


CREATE INDEX email_logs_booking_idx
  ON public.email_logs (booking_id);


CREATE INDEX email_logs_user_idx
  ON public.email_logs (user_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  AUDIT LOGS
--  Immutable record of user and admin actions for GDPR and compliance.
--  Written by service role from server actions — no user write access.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.audit_logs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          text         NOT NULL,   -- e.g. 'booking.confirmed', 'artist.deleted'
  resource_type   text,                    -- e.g. 'booking', 'artist'
  resource_id     uuid,
  metadata        jsonb,
  ip_address      text,
  created_at      timestamptz  NOT NULL DEFAULT NOW()
  -- NOTE: No updated_at — audit logs are append-only and immutable.
);


CREATE INDEX audit_logs_user_idx
  ON public.audit_logs (user_id, created_at DESC);


CREATE INDEX audit_logs_resource_idx
  ON public.audit_logs (resource_type, resource_id);


CREATE INDEX audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
--  CUSTOM DOMAINS  [STUB — Deferred to v2, Studio plan]
--
--  §4 ruling: Do not build Vercel Domains API integration now.
--  Table exists so plan-gating checks (PLAN_LIMITS.customDomain) have a DB
--  counterpart and the feature can be activated in v2 without a new migration.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.custom_domains (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id    uuid         NOT NULL UNIQUE
                              REFERENCES public.artists(id) ON DELETE CASCADE,
  domain       text         NOT NULL UNIQUE
                              CHECK (char_length(domain) <= 253),
  verified     boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  NOT NULL DEFAULT NOW(),
  updated_at   timestamptz  NOT NULL DEFAULT NOW()
  -- v2: add vercel_domain_id, dns_txt_record, verified_at, etc.
);


CREATE TRIGGER set_custom_domains_updated_at
  BEFORE UPDATE ON public.custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
--  ANALYTICS EVENTS  [STUB — Deferred to v2, Pro+ plan]
--
--  §4 ruling: Do not build analytics dashboards now.
--  Table exists so plan-gating checks (PLAN_LIMITS.analytics) work and the
--  feature can be activated in v2 without a new migration.
-- ══════════════════════════════════════════════════════════════════════════════


CREATE TABLE public.analytics_events (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id    uuid         NOT NULL
                              REFERENCES public.artists(id) ON DELETE CASCADE,
  event_type   text         NOT NULL,   -- e.g. 'page_view', 'booking_started'
  metadata     jsonb,
  created_at   timestamptz  NOT NULL DEFAULT NOW()
  -- v2: add session_id, referrer, country_code, etc.
);


CREATE INDEX analytics_events_artist_idx
  ON public.analytics_events (artist_id, created_at DESC);


CREATE INDEX analytics_events_type_idx
  ON public.analytics_events (artist_id, event_type, created_at DESC);