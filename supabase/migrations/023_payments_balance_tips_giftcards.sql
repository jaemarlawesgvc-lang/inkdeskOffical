-- Migration 023: Final balance collection, tips, and gift cards
--
-- All three features route funds in full to the artist's connected Stripe
-- account via destination charges (the platform takes NO commission), mirroring
-- the existing deposit flow. This migration is idempotent (IF NOT EXISTS guards)
-- and enables RLS on every new table.

-- ===========================================================================
-- 1) FINAL BALANCE COLLECTION — new columns on bookings
-- ===========================================================================
-- deposit_amount / deposit_paid / stripe_payment_intent_id already exist (001).
-- total_amount (numeric pounds) also already exists; total_amount_pence is the
-- authoritative integer-pence figure the balance endpoint derives from.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS total_amount_pence        integer,
  ADD COLUMN IF NOT EXISTS balance_paid              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_payment_intent_id text;

-- ===========================================================================
-- 2) TIPS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.tips (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  artist_id                uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  amount_pence             integer NOT NULL CHECK (amount_pence > 0),
  stripe_payment_intent_id text,
  client_name              text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tips_artist_id_idx  ON public.tips (artist_id);
CREATE INDEX IF NOT EXISTS tips_booking_id_idx ON public.tips (booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS tips_stripe_payment_intent_id_key
  ON public.tips (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Artists may read their own tips. Inserts are performed exclusively by the
-- Stripe webhook using the service-role key (which bypasses RLS), so no
-- INSERT policy is defined — this table is read-only to authenticated users.
DROP POLICY IF EXISTS "artists_read_own_tips" ON public.tips;
CREATE POLICY "artists_read_own_tips" ON public.tips
  FOR SELECT USING (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- ===========================================================================
-- 3) GIFT CARDS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id                uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  code                     text NOT NULL UNIQUE,
  initial_amount_pence     integer NOT NULL CHECK (initial_amount_pence > 0),
  remaining_amount_pence   integer NOT NULL CHECK (remaining_amount_pence >= 0),
  purchaser_email          text,
  recipient_email          text,
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'redeemed', 'void')),
  stripe_payment_intent_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_key ON public.gift_cards (code);
CREATE INDEX IF NOT EXISTS gift_cards_artist_id_idx  ON public.gift_cards (artist_id);
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_stripe_payment_intent_id_key
  ON public.gift_cards (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Artists may read their own gift cards. Public lookup by code happens only via
-- the service-role redeem/purchase APIs (which bypass RLS); no public SELECT
-- policy is defined so codes are never enumerable by anonymous clients.
DROP POLICY IF EXISTS "artists_read_own_gift_cards" ON public.gift_cards;
CREATE POLICY "artists_read_own_gift_cards" ON public.gift_cards
  FOR SELECT USING (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
