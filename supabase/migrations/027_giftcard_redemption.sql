-- Migration 027: Apply a gift card to a booking's deposit or balance payment
--
-- Links a redeemed gift card to the booking it was applied against and records
-- exactly how much of the card was consumed (in pence). Both the real decrement
-- of gift_cards.remaining_amount_pence and the link here are performed AFTER
-- payment succeeds (Stripe webhook), or — when a card fully covers the amount
-- due and no Stripe charge is created — directly by the create-deposit /
-- create-balance endpoints. Idempotent (IF NOT EXISTS guards).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS gift_card_id                   uuid REFERENCES public.gift_cards(id),
  ADD COLUMN IF NOT EXISTS gift_card_amount_applied_pence integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bookings_gift_card_id_idx ON public.bookings (gift_card_id);

NOTIFY pgrst, 'reload schema';
