-- Public "report this listing" intake (apps/store) -- the safety net for
-- the unverified self-attach claim path (business_claims.method =
-- 'unverified'): a real owner who shows up after someone else has
-- self-attached to their unclaimed-and-contact-info-less listing can
-- dispute it here. Staff review in apps/admin; upholding a dispute
-- revokes the claim (resets stores.owner_id/claim_status/claimed_at).
CREATE TABLE business_claim_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  reporter_phone TEXT,
  relationship VARCHAR(20) NOT NULL DEFAULT 'owner'
    CHECK (relationship IN ('owner', 'employee', 'other')),
  details TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'upheld', 'dismissed')),
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_claim_disputes_store_id ON business_claim_disputes(store_id, created_at DESC);
CREATE INDEX idx_business_claim_disputes_status ON business_claim_disputes(status, created_at DESC);
ALTER TABLE business_claim_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE business_claim_disputes FROM anon, authenticated;
