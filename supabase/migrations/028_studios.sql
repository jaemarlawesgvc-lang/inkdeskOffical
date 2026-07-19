-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 028: Studios / Multi-artist foundation
--
--  PURELY ADDITIVE. This migration introduces a studio membership layer WITHOUT
--  altering any existing table's existing columns, semantics, or RLS policies.
--
--  Design:
--    • New tables (studios, studio_members) each own their RLS, deny-by-default.
--    • artists.studio_id is added as a NULLABLE, optional link — a solo artist
--      with studio_id = NULL is completely unaffected by anything here.
--    • The studio APIs authorise with the service-role admin client + EXPLICIT
--      application-code membership checks (mirroring the admin route pattern).
--      The RLS below is a defence-in-depth backstop, not the primary gate.
--    • Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
--  STUDIOS
--  One row per studio. owner_user_id is the auth.users id of the studio owner
--  (the account on the Studio plan that created it). One studio per owner.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.studios (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug           text         NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 2 AND 60),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- One studio per owner (the foundation assumes a single studio per owning account).
CREATE UNIQUE INDEX IF NOT EXISTS studios_owner_unique ON public.studios (owner_user_id);

DROP TRIGGER IF EXISTS set_studios_updated_at ON public.studios;
CREATE TRIGGER set_studios_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
--  STUDIO MEMBERS
--  Roster of a studio: the owner, resident/guest artists, and front-desk staff.
--
--  user_id is NULLABLE: an emailed invite exists as a row before the invitee has
--  an account. artist_id links the member to their artists row once known.
--  commission_rate_pct / booth_rent_pence are the studio's REPORTING terms for
--  that member (see the earnings ledger — reporting only, no money is moved).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.studio_members (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id            uuid          NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  -- Nullable until an emailed invite is accepted / linked to an account.
  user_id              uuid          REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional link to the member's artist record (set when linking an existing artist).
  artist_id            uuid          REFERENCES public.artists(id) ON DELETE SET NULL,
  role                 text          NOT NULL DEFAULT 'artist'
                                     CHECK (role IN ('owner', 'artist', 'front_desk')),
  -- Reporting terms only. Commission is a % of the member's service revenue.
  commission_rate_pct  numeric(5,2)  CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100),
  -- Flat booth/chair rent for the period, in integer pence.
  booth_rent_pence     integer       CHECK (booth_rent_pence >= 0),
  status               text          NOT NULL DEFAULT 'invited'
                                     CHECK (status IN ('invited', 'active', 'removed')),
  invited_email        text,
  created_at           timestamptz   NOT NULL DEFAULT now(),

  -- One membership row per (studio, user). NULL user_ids are distinct in PG, so
  -- multiple pending email-only invites can coexist before acceptance.
  CONSTRAINT studio_members_studio_user_unique UNIQUE (studio_id, user_id)
);

CREATE INDEX IF NOT EXISTS studio_members_studio_idx  ON public.studio_members (studio_id);
CREATE INDEX IF NOT EXISTS studio_members_user_idx    ON public.studio_members (user_id)   WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS studio_members_artist_idx  ON public.studio_members (artist_id) WHERE artist_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
--  ARTISTS.studio_id  (additive, nullable optional link)
--  A solo artist keeps studio_id = NULL and is entirely unaffected.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artists_studio_id_idx
  ON public.artists (studio_id) WHERE studio_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
--  HELPER FUNCTIONS  (SECURITY DEFINER + fixed search_path — mirrors is_admin())
--  SECURITY DEFINER lets these bypass RLS on studios/studio_members so the RLS
--  policies below can call them without recursive deadlock.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_studio_owner(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studios
    WHERE id = p_studio_id AND owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_studio_member(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_studio_owner(p_studio_id)
      OR EXISTS (
        SELECT 1 FROM public.studio_members
        WHERE studio_id = p_studio_id
          AND user_id = auth.uid()
          AND status = 'active'
      );
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
--  RLS — STUDIOS
--  Owner: full access to their own studio. Members: SELECT only.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studios_owner_all" ON public.studios;
CREATE POLICY "studios_owner_all"
  ON public.studios FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "studios_member_select" ON public.studios;
CREATE POLICY "studios_member_select"
  ON public.studios FOR SELECT
  TO authenticated
  USING (public.is_studio_member(id));


-- ═══════════════════════════════════════════════════════════════════════════════
--  RLS — STUDIO MEMBERS
--  Owner: manages every member row of studios they own. Member: reads own row.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_members_owner_all" ON public.studio_members;
CREATE POLICY "studio_members_owner_all"
  ON public.studio_members FOR ALL
  TO authenticated
  USING (public.is_studio_owner(studio_id))
  WITH CHECK (public.is_studio_owner(studio_id));

DROP POLICY IF EXISTS "studio_members_self_select" ON public.studio_members;
CREATE POLICY "studio_members_self_select"
  ON public.studio_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- Reload PostgREST schema cache so the new tables/columns are exposed.
NOTIFY pgrst, 'reload schema';
