-- Staff-only designation (never vendor self-service) -- gates both which
-- vendors a campaign can target (apps/dashboard's admin campaign routes
-- reject a non-partner store_id) and, belt-and-suspenders, whether an
-- already-created attribution is still honored at checkout time
-- (apps/store's computePaymentSplit re-checks stores.is_partner at order
-- time, not just whatever it was when the attribution was created).
ALTER TABLE stores ADD COLUMN is_partner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN partner_designated_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN partner_designated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_stores_is_partner ON stores(is_partner) WHERE is_partner = true;

-- One row per Stora-built marketing campaign (v1: always a 'quiz').
-- Scoped to exactly one partner vendor -- config is entirely JSONB
-- (questions, options, tag mappings, result-screen copy) so a new
-- campaign never needs a schema change. attribution_window_hours is
-- per-campaign, not a single global constant, so staff can tune how long
-- a completed quiz keeps earning the partner rate without a deploy.
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'quiz' CHECK (type IN ('quiz')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  config JSONB NOT NULL DEFAULT '{}',
  attribution_window_hours INTEGER NOT NULL DEFAULT 48 CHECK (attribution_window_hours > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_store_id ON campaigns(store_id);
CREATE INDEX idx_campaigns_status ON campaigns(status) WHERE status = 'active';

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- One row per quiz completion. store_id is denormalized from campaigns at
-- creation time (not joined at read time) -- this is what lets
-- computePaymentSplit's per-store loop in orders/create/route.js filter
-- directly on store_id with no join, and protects an in-flight
-- attribution from a later campaign edit changing its store_id (campaigns
-- never actually reassign store_id in practice, but this keeps the
-- attribution's target frozen regardless). token is the opaque value
-- carried in the stora_campaign_attribution cookie -- never the raw
-- campaign/store id, so a client can't forge/guess a valid attribution.
-- customer_id is nullable: the quiz is completable before the customer
-- ever logs in.
--
-- Deliberately MULTI-USE: expires_at is the only validity check, there is
-- no per-attribution "already used" gate. Every order placed with this
-- attribution's store before it expires earns the partner rate, not just
-- the first -- first_converted_at is purely informational (time from quiz
-- completion to first purchase), set once via COALESCE, and is never read
-- as a gate anywhere.
CREATE TABLE campaign_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  token VARCHAR(64) NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  recommended_product_ids JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  first_converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX campaign_attributions_token_uq ON campaign_attributions(token);
-- The exact lookup computePaymentSplit needs per store-group: "is there a
-- live attribution for this token, targeting this store".
CREATE INDEX idx_campaign_attributions_store_expiry ON campaign_attributions(store_id, expires_at);
CREATE INDEX idx_campaign_attributions_campaign_id ON campaign_attributions(campaign_id);

ALTER TABLE campaign_attributions ENABLE ROW LEVEL SECURITY;

-- Additive snapshot columns on order_payment_splits -- the existing
-- platform_commission_rate/platform_commission_amount columns keep
-- meaning "the base 2% only", completely untouched, so a non-attributed
-- order's row stays byte-for-byte identical to pre-feature behavior
-- (every historical row correctly defaults to false/0, no backfill
-- needed). campaign_attribution_id is intentionally NOT unique -- under
-- multi-use, one attribution can legitimately back many
-- order_payment_splits rows across separate orders. ON DELETE SET NULL
-- (not CASCADE) since order_payment_splits is permanent financial history
-- and must never be affected by a marketing-table cleanup.
ALTER TABLE order_payment_splits ADD COLUMN is_partner_attributed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_payment_splits ADD COLUMN campaign_attribution_id UUID REFERENCES campaign_attributions(id) ON DELETE SET NULL;
ALTER TABLE order_payment_splits ADD COLUMN partner_commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0
  CHECK (partner_commission_rate BETWEEN 0 AND 1);
ALTER TABLE order_payment_splits ADD COLUMN partner_commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0
  CHECK (partner_commission_amount >= 0);

CREATE INDEX idx_order_payment_splits_partner_attributed
  ON order_payment_splits(is_partner_attributed) WHERE is_partner_attributed = true;
