-- Harden listing subscription payments with durable server-side records,
-- deterministic linkage to store/user, and webhook idempotency.

CREATE TABLE IF NOT EXISTS listing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack',
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
  CONSTRAINT listing_subscriptions_status_check CHECK (status IN ('none', 'active', 'past_due', 'cancelled')),
  CONSTRAINT listing_subscriptions_provider_check CHECK (provider = 'paystack')
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_subscriptions_store_unique
  ON listing_subscriptions(store_id);

CREATE UNIQUE INDEX IF NOT EXISTS listing_subscriptions_provider_sub_code_unique
  ON listing_subscriptions(provider_subscription_code)
  WHERE provider_subscription_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_subscriptions_owner_idx
  ON listing_subscriptions(owner_id);

CREATE TABLE IF NOT EXISTS listing_subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_subscription_code TEXT,
  provider_customer_code TEXT,
  provider_plan_code TEXT,
  amount_kobo INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'initialized',
  paid_at TIMESTAMPTZ,
  authorization_url TEXT,
  verification_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_subscription_transactions_provider_check CHECK (provider = 'paystack'),
  CONSTRAINT listing_subscription_transactions_status_check CHECK (status IN ('initialized', 'pending', 'success', 'failed', 'abandoned'))
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_sub_tx_provider_ref_unique
  ON listing_subscription_transactions(provider, provider_reference);

CREATE UNIQUE INDEX IF NOT EXISTS listing_sub_tx_provider_tx_id_unique
  ON listing_subscription_transactions(provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_sub_tx_store_created_idx
  ON listing_subscription_transactions(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_sub_tx_owner_created_idx
  ON listing_subscription_transactions(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  CONSTRAINT payment_webhook_events_provider_check CHECK (provider = 'paystack'),
  CONSTRAINT payment_webhook_events_status_check CHECK (status IN ('received', 'processed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_provider_event_unique
  ON payment_webhook_events(provider, provider_event_key);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_payload_hash_unique
  ON payment_webhook_events(provider, payload_hash);

-- Payment tables are server-only (API routes/webhooks use service role).
-- Enable RLS and avoid exposing these records to anon/authenticated clients.
ALTER TABLE listing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE listing_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE listing_subscription_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE payment_webhook_events FROM anon, authenticated;

INSERT INTO listing_subscriptions (
  store_id,
  owner_id,
  provider,
  provider_subscription_code,
  provider_plan_code,
  status,
  next_payment_date,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.owner_id,
  'paystack',
  s.subscription_paystack_code,
  NULL,
  s.subscription_status,
  s.subscription_next_payment_date,
  jsonb_build_object('source', 'stores_backfill'),
  NOW(),
  NOW()
FROM stores s
WHERE s.platform_mode = 'listing'
ON CONFLICT (store_id) DO UPDATE
SET
  provider_subscription_code = EXCLUDED.provider_subscription_code,
  status = EXCLUDED.status,
  next_payment_date = EXCLUDED.next_payment_date,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
