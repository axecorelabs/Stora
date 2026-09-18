-- Full-store subscription lifecycle tables and store-level billing fields.
-- Kept separate from listing subscriptions to avoid cross-mode conflicts.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS full_store_subscription_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS full_store_subscription_paystack_code TEXT,
  ADD COLUMN IF NOT EXISTS full_store_subscription_next_payment_date TIMESTAMPTZ;

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_full_store_subscription_status_check;

ALTER TABLE stores
  ADD CONSTRAINT stores_full_store_subscription_status_check
  CHECK (full_store_subscription_status IN ('none', 'active', 'past_due', 'cancelled'));

CREATE TABLE IF NOT EXISTS full_store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_code TEXT,
  provider_subscription_code TEXT,
  provider_plan_code TEXT,
  status TEXT NOT NULL DEFAULT 'none',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT full_store_subscriptions_status_check CHECK (status IN ('none', 'active', 'past_due', 'cancelled')),
  CONSTRAINT full_store_subscriptions_provider_check CHECK (provider IN ('paystack', 'manual'))
);

CREATE UNIQUE INDEX IF NOT EXISTS full_store_subscriptions_store_unique
  ON full_store_subscriptions(store_id);

CREATE UNIQUE INDEX IF NOT EXISTS full_store_subscriptions_provider_sub_code_unique
  ON full_store_subscriptions(provider_subscription_code)
  WHERE provider_subscription_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS full_store_subscriptions_owner_idx
  ON full_store_subscriptions(owner_id);

CREATE TABLE IF NOT EXISTS full_store_subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_subscription_code TEXT,
  provider_customer_code TEXT,
  provider_plan_code TEXT,
  amount_kobo BIGINT,
  currency TEXT,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  authorization_url TEXT,
  verification_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT full_store_subscription_transactions_provider_check CHECK (provider IN ('paystack', 'manual')),
  CONSTRAINT full_store_subscription_transactions_status_check CHECK (status IN ('initialized', 'pending', 'success', 'failed', 'abandoned'))
);

CREATE UNIQUE INDEX IF NOT EXISTS full_store_subscription_transactions_provider_ref_unique
  ON full_store_subscription_transactions(provider, provider_reference);

CREATE UNIQUE INDEX IF NOT EXISTS full_store_subscription_transactions_provider_txn_unique
  ON full_store_subscription_transactions(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS full_store_subscription_transactions_store_idx
  ON full_store_subscription_transactions(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS full_store_subscription_transactions_owner_idx
  ON full_store_subscription_transactions(owner_id, created_at DESC);

ALTER TABLE full_store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE full_store_subscription_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE full_store_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE full_store_subscription_transactions FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
