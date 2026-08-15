-- Paystack marketplace payments: one order_payments row still represents
-- the single Paystack transaction for an order (its own order_id UNIQUE
-- constraint is unchanged and correct), but a multi-vendor cart splits
-- that one transaction's proceeds across several vendor subaccounts.
-- order_payment_splits records that per-vendor breakdown.
--
-- status is a *settlement* status (has Paystack actually paid the
-- vendor's bank account yet), separate from order_payments.status (did
-- the customer's charge succeed). Every vendor subaccount is created
-- with settlement_schedule: 'manual', so funds sit in the subaccount
-- (not yet paid to the vendor's bank) for a fixed 24h window before a
-- scheduled job triggers settlement -- this is what makes a refund safe
-- by default: once a split is 'settled', Stora's refund action for it
-- is simply not offered, so the reversal path never has to touch an
-- already-settled row.
CREATE TABLE order_payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_payment_id UUID NOT NULL REFERENCES order_payments(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  subaccount_code VARCHAR(50) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL CHECK (gross_amount >= 0),
  platform_commission_rate DECIMAL(5,4) NOT NULL CHECK (platform_commission_rate BETWEEN 0 AND 1),
  platform_commission_amount DECIMAL(12,2) NOT NULL CHECK (platform_commission_amount >= 0),
  net_amount_to_vendor DECIMAL(12,2) NOT NULL CHECK (net_amount_to_vendor >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX order_payment_splits_order_store_uq ON order_payment_splits(order_id, store_id);
CREATE INDEX idx_order_payment_splits_order_id ON order_payment_splits(order_id);
CREATE INDEX idx_order_payment_splits_store_id ON order_payment_splits(store_id);
-- Used by the settlement-trigger cron job to find splits past the 24h holdback.
CREATE INDEX idx_order_payment_splits_pending ON order_payment_splits(status) WHERE status = 'pending';

ALTER TABLE order_payment_splits ENABLE ROW LEVEL SECURITY;

-- Checkout eligibility ("can this vendor be paid online yet") and the
-- settlement-trigger/refund-cutoff logic both need to know whether a
-- store has a configured Paystack subaccount. A generated column is
-- simpler to reason about and index than an expression on the JSONB
-- column directly.
ALTER TABLE stores ADD COLUMN paystack_ready BOOLEAN
  GENERATED ALWAYS AS ((bank_details ->> 'paystack_subaccount_code') IS NOT NULL) STORED;

CREATE INDEX idx_stores_paystack_ready ON stores(paystack_ready) WHERE paystack_ready = TRUE;
