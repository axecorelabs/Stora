-- Tracks real Paystack settlement confirmation per vendor split, separate
-- from the existing 'pending'/'settled'/'reversed' status enum (which
-- already allowed 'settled' but nothing ever set it -- see
-- apps/store/src/app/api/payments/sync-settlements/route.js, the new daily
-- cron that polls Paystack's Settlement API and is the only thing that
-- transitions a split from 'pending' to 'settled').
--
-- settled_at is when Paystack actually paid the vendor's bank account
-- (from the settlement record's effective date), not when this row was
-- last touched -- updated_at already covers that. paystack_settlement_id
-- makes the sync job idempotent (a settlement already recorded here is
-- never re-matched) and gives support a concrete Paystack reference to
-- look up if a vendor disputes a payout.
ALTER TABLE order_payment_splits
  ADD COLUMN settled_at TIMESTAMPTZ,
  ADD COLUMN paystack_settlement_id VARCHAR(50);

-- Lets the sync job check "have I already recorded this settlement" without
-- a full table scan.
CREATE INDEX idx_order_payment_splits_settlement_id
  ON order_payment_splits(paystack_settlement_id) WHERE paystack_settlement_id IS NOT NULL;
