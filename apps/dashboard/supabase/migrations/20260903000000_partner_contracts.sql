-- Replaces the flat-8%-for-every-partner model with real negotiated
-- contracts (see apps/store/src/app/api/orders/create/route.js's old
-- PARTNER_COMMISSION_RATE constant, applied unconditionally to every
-- is_partner=true store regardless of any actual agreement). An admin now
-- proposes specific terms (a flat fee or a percentage) per vendor, the
-- vendor is emailed and sees the proposal as a modal on their next
-- dashboard load, and only becomes an official partner by accepting.
CREATE TABLE partner_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'declined', 'terminated')),
  rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN ('percentage', 'flat')),
  rate_value NUMERIC(12, 4) NOT NULL CHECK (rate_value >= 0),
  terms TEXT,
  proposed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_contracts_store_id ON partner_contracts(store_id);

-- Only one live proposal per store at a time -- the admin UI relies on
-- this to block a second proposal while one's still pending.
CREATE UNIQUE INDEX partner_contracts_one_pending_uq ON partner_contracts(store_id) WHERE status = 'proposed';

-- computePaymentSplit's per-store lookup: "does this store have a
-- currently accepted contract" (there's at most one at a time in
-- practice -- a new proposal is blocked while one's pending, and
-- terminating sets the old row to 'terminated' before any new one could
-- be accepted -- but nothing in the schema enforces that invariant
-- itself, so callers still order by created_at desc / limit 1 rather
-- than assuming exactly one row).
CREATE INDEX idx_partner_contracts_accepted ON partner_contracts(store_id) WHERE status = 'accepted';

ALTER TABLE partner_contracts ENABLE ROW LEVEL SECURITY;

-- Backfill: every existing partner keeps its exact current deal (flat 8%,
-- unconditionally) as a real contract row, so checkout math has exactly
-- one path (the active contract) instead of a legacy fallback running
-- forever alongside the new system.
INSERT INTO partner_contracts (store_id, status, rate_type, rate_value, terms, proposed_at, responded_at)
SELECT id, 'accepted', 'percentage', 0.08, 'Legacy 8% partner rate (auto-migrated).', COALESCE(partner_designated_at, created_at), COALESCE(partner_designated_at, created_at)
FROM stores WHERE is_partner = true;

-- order_payment_splits.partner_commission_rate is DECIMAL(5,4) CHECK
-- (BETWEEN 0 AND 1) -- it can only ever represent a percentage, not a
-- flat-fee contract's actual value. partner_commission_amount already
-- correctly captures the real Naira amount taken regardless of type, so
-- that column's meaning is untouched (0 for a flat-rate split, same as
-- before); these two new columns add the type + a traceable link back to
-- the exact contract that applied, for record-keeping/display.
ALTER TABLE order_payment_splits ADD COLUMN partner_rate_type VARCHAR(20) CHECK (partner_rate_type IN ('percentage', 'flat'));
ALTER TABLE order_payment_splits ADD COLUMN partner_contract_id UUID REFERENCES partner_contracts(id) ON DELETE SET NULL;
