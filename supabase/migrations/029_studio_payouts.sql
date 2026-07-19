-- ══════════════════════════════════════════════════════════════════════════════
--  InkDesk — Migration 029: Automated studio commission payouts (Stripe Connect)
--
--  PURELY ADDITIVE. Extends the studio layer (migration 028) so that a studio
--  can receive its commission automatically when a studio-affiliated artist
--  collects a deposit/balance.
--
--  Topology (money):
--    • The client's deposit/balance is still a DESTINATION CHARGE to the ARTIST
--      (unchanged). For a studio-affiliated artist with a commission rate, the
--      PaymentIntent additionally carries `application_fee_amount`, which — on a
--      destination charge — is RETAINED BY THE PLATFORM.
--    • The webhook then forwards that fee to the STUDIO's own connected account
--      via a Stripe Transfer and records a row here. Net: the platform keeps
--      nothing; the studio gets the commission; the artist gets the remainder.
--    • Solo artists (no studio / no commission rate) are entirely unaffected —
--      no application fee, no transfer, no row here.
--
--  Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
--  STUDIOS — Connect payout account (additive columns)
--  A studio needs its OWN connected account (distinct from any artist's) to
--  receive commission transfers. 'none' until the owner starts onboarding.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status     text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS studios_connect_account_idx
  ON public.studios (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
--  STUDIO COMMISSION TRANSFERS
--  Ledger of platform → studio commission forwards. One row per deposit/balance
--  PaymentIntent (stripe_payment_intent_id is UNIQUE — the webhook idempotency
--  gate). status walks 'pending' → 'paid' (transfer created) or 'failed'.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.studio_commission_transfers (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id                 uuid        NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  artist_id                 uuid        NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  -- Nullable: a booking row may be deleted, but the money record should remain.
  booking_id                uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  source                    text        NOT NULL CHECK (source IN ('deposit', 'balance')),
  amount_pence              integer     NOT NULL CHECK (amount_pence >= 0),
  stripe_transfer_id        text,
  -- One transfer per source PaymentIntent — the webhook's idempotency claim.
  stripe_payment_intent_id  text        NOT NULL UNIQUE,
  status                    text        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'paid', 'failed')),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_commission_transfers_studio_idx
  ON public.studio_commission_transfers (studio_id);
CREATE INDEX IF NOT EXISTS studio_commission_transfers_artist_idx
  ON public.studio_commission_transfers (artist_id);
CREATE INDEX IF NOT EXISTS studio_commission_transfers_status_idx
  ON public.studio_commission_transfers (status);


-- ═══════════════════════════════════════════════════════════════════════════════
--  RLS — STUDIO COMMISSION TRANSFERS
--  Deny-by-default. Studio owner may READ their own studio's transfers. Writes
--  happen only from the webhook via the service-role client (which bypasses RLS)
--  — no INSERT/UPDATE policy is granted to authenticated users.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.studio_commission_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_commission_transfers_owner_select" ON public.studio_commission_transfers;
CREATE POLICY "studio_commission_transfers_owner_select"
  ON public.studio_commission_transfers FOR SELECT
  TO authenticated
  USING (public.is_studio_owner(studio_id));


-- Reload PostgREST schema cache so the new tables/columns are exposed.
NOTIFY pgrst, 'reload schema';
