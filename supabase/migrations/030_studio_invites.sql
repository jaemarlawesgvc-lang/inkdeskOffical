-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 030: Studio invite tokens
--
--  PURELY ADDITIVE. Builds on migration 028 (studios / studio_members). Adds the
--  two columns the email-based INVITE + ACCEPT flow needs:
--
--    • invite_token       — an unguessable uuid carried in the accept link
--                           (`/studio/accept?token=<invite_token>`). Defaulted so
--                           every row (new and existing) has one.
--    • invite_expires_at  — when the invite link stops being acceptable (nullable;
--                           NULL means "no expiry recorded", treated as still open
--                           by the accept endpoint only if a token matches).
--
--  Idempotent: ADD COLUMN IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS, and a
--  backfill UPDATE guarded by IS NULL so re-runs are no-ops.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Columns ───────────────────────────────────────────────────────────────────
-- gen_random_uuid() is volatile, so ADD COLUMN ... DEFAULT gen_random_uuid()
-- assigns a DISTINCT token to each pre-existing row (Postgres evaluates the
-- default per-row when backfilling a volatile default). The guarded UPDATE below
-- is a belt-and-braces backfill for any row that somehow still has a NULL token.
ALTER TABLE public.studio_members
  ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid();

ALTER TABLE public.studio_members
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- Belt-and-braces backfill (no-op on a fresh column that already defaulted).
UPDATE public.studio_members
  SET invite_token = gen_random_uuid()
  WHERE invite_token IS NULL;


-- ── Uniqueness ────────────────────────────────────────────────────────────────
-- A token must resolve to at most one membership row. Partial (WHERE NOT NULL)
-- so a future explicit NULL never trips the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS studio_members_invite_token_unique
  ON public.studio_members (invite_token)
  WHERE invite_token IS NOT NULL;


-- Reload PostgREST schema cache so the new columns are exposed.
NOTIFY pgrst, 'reload schema';
