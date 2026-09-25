-- Phase 0 of "claim your business": lets Stora ops seed an unclaimed
-- listing before any real owner exists. Phase 2 (OTP/CAC/document
-- verification flow) and Phase 3 (dispute/request-access) land later --
-- this migration only adds the columns/tables their code will need,
-- wired to nothing yet.

-- stores.owner_id was NOT NULL UNIQUE -- every store had exactly one
-- owner from creation. Postgres treats multiple NULLs as distinct under
-- a plain UNIQUE constraint, so "a user owns at most one store" still
-- holds once nullable -- no partial-unique-index rework needed.
ALTER TABLE stores ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS claim_status VARCHAR(20) NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_claim_status_check;
ALTER TABLE stores
  ADD CONSTRAINT stores_claim_status_check
  CHECK (claim_status IN ('unclaimed', 'claimed'));

-- Existing rows all get 'claimed' from the column DEFAULT (every row
-- today has a real owner_id). claimed_at is left NULL for them -- there's
-- no real claim EVENT in their history to backfill; don't assume
-- claimed_at is set just because claim_status = 'claimed'.

CREATE INDEX IF NOT EXISTS idx_stores_claim_status ON stores(claim_status);

-- business_claims: one row per claim ATTEMPT, not a single overwritten
-- state -- same attempt-log shape as vendor_verifications, which
-- Phase 2's OTP/CAC/document flow will insert into and query the same
-- way that route does. Pure schema only in this build -- no endpoint
-- reads or writes this table yet.
CREATE TABLE business_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- Nullable: Phase 2 may need to log an attempt (e.g. a failed OTP)
  -- before the claimant even has an account.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  method VARCHAR(20) NOT NULL
    CHECK (method IN ('phone_otp', 'email_otp', 'cac_lookup', 'documents')),
  evidence JSONB DEFAULT '{}',
  -- Deliberately no FK yet -- whether a claim is reviewed by staff
  -- (admin_users) or an existing owner (users, for the dispute flow)
  -- isn't decided until Phase 3.
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_claims_store_id ON business_claims(store_id, created_at DESC);
CREATE INDEX idx_business_claims_user_id ON business_claims(user_id);
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;

-- business_members: multi-user store access (a claimed owner adding
-- managers/staff, or a future request-access grant). Pure schema --
-- avoids retrofitting this onto stores.owner_id (still the single
-- "primary owner" column, unchanged) once that's needed.
CREATE TABLE business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'staff'
    CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX business_members_store_user_uq ON business_members(store_id, user_id);
CREATE INDEX idx_business_members_store_id ON business_members(store_id);
CREATE INDEX idx_business_members_user_id ON business_members(user_id);
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
