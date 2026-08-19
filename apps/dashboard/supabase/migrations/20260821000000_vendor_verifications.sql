-- Vendor identity verification via QoreID (NIN + face-match). One row per
-- attempt, not a single overwritten state -- gives an audit trail and
-- backs the rate-limit/in-flight-guard checks in the API route. Never
-- holds a raw NIN or the selfie image -- only masked/derived data, so
-- this needs no new encryption-at-rest infrastructure (see stores.state
-- for the same "optional, nudged not blocked" precedent this follows).
--
-- On success this flow sets the ALREADY-EXISTING stores.is_verified /
-- verification_status columns (added in 20260717000000_initial_schema.sql)
-- -- every existing read path for those (the storefront's "Verified by
-- Stora" badge, VendorCard, VendorSearchCard) lights up with zero changes.
CREATE TABLE vendor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','error')),
  nin_last4 TEXT,
  provider_reference TEXT,
  name_match BOOLEAN,
  face_match_score NUMERIC,
  matching_threshold NUMERIC,
  consent_given_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vendor_verifications_store ON vendor_verifications(store_id, created_at DESC);
