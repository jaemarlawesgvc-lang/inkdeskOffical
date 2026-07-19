-- 031_commission_reversal_and_retry.sql
--
-- Refund reversal + failed-transfer retry for studio commission payouts.
--
-- When a deposit/balance is refunded, the onward commission Transfer to the
-- studio must be reversed too (otherwise the platform eats the commission). This
-- adds a 'reversed' terminal state and the reversal id. It also supports a retry
-- sweep for transfers that failed (e.g. platform-balance timing on a same-tick
-- transfer) via a retry counter.

-- Extend the status CHECK to include 'reversed'.
ALTER TABLE studio_commission_transfers
  DROP CONSTRAINT IF EXISTS studio_commission_transfers_status_check;

ALTER TABLE studio_commission_transfers
  ADD CONSTRAINT studio_commission_transfers_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'reversed'));

ALTER TABLE studio_commission_transfers
  ADD COLUMN IF NOT EXISTS stripe_reversal_id text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Retry sweep looks up failed / stuck-pending rows by status + age.
CREATE INDEX IF NOT EXISTS studio_commission_transfers_status_idx
  ON studio_commission_transfers (status, created_at);

NOTIFY pgrst, 'reload schema';
