-- 032_giftcard_ledger.sql
--
-- Gift-card RESERVATION LEDGER — makes gift-card redemption double-spend-safe.
--
-- The prior model decremented a gift card only in the Stripe webhook on payment
-- success and recorded a single (gift_card_id, amount) pair on the booking. That
-- allowed (a) two concurrent partial redemptions of the same code to both succeed
-- (double-spend), (b) the booking's single gift-card column to be clobbered when a
-- card was applied to both the deposit and the balance, and (c) no clean way to
-- restore value on refund.
--
-- This table is the SOURCE OF TRUTH for how much of a card is committed to which
-- payment. Its lifecycle:
--   reserved  — value decremented from the card at create time, charge pending
--   consumed  — the associated PaymentIntent succeeded
--   released  — the PaymentIntent failed; value re-credited to the card
--   refunded  — the charge was refunded; value re-credited to the card
--
-- The bookings.gift_card_id / gift_card_amount_applied_pence columns are retained
-- for display only; this ledger is authoritative for money.

CREATE TABLE IF NOT EXISTS public.gift_card_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id       uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  booking_id         uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  -- Null for a fully-covered application (no Stripe charge is created). For a
  -- partial application this keys the row to the PaymentIntent and is the
  -- idempotency gate for endpoint retries + webhook redelivery.
  payment_intent_id  text,
  source             text NOT NULL CHECK (source IN ('deposit', 'balance')),
  amount_pence       integer NOT NULL CHECK (amount_pence >= 0),
  status             text NOT NULL DEFAULT 'reserved'
                       CHECK (status IN ('reserved', 'consumed', 'released', 'refunded')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One application per PaymentIntent — the idempotency claim for the partial path.
CREATE UNIQUE INDEX IF NOT EXISTS gift_card_applications_payment_intent_id_key
  ON public.gift_card_applications (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS gift_card_applications_gift_card_id_idx
  ON public.gift_card_applications (gift_card_id);

CREATE INDEX IF NOT EXISTS gift_card_applications_booking_id_idx
  ON public.gift_card_applications (booking_id);

-- Service-role (admin client) access only, matching gift_cards. No public policies.
ALTER TABLE public.gift_card_applications ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
