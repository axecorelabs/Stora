-- Widen business_claims' method CHECK to add 'unverified' -- the
-- self-attach claim path for listings with no store_email/store_phone on
-- file to verify against (see
-- apps/dashboard/src/app/api/claims/[storeId]/attach/route.js). Approved
-- immediately on insert; review here is reactive-only via the
-- report-listing dispute flow (business_claim_disputes), not a pre-claim
-- gate.
ALTER TABLE business_claims DROP CONSTRAINT business_claims_method_check;
ALTER TABLE business_claims ADD CONSTRAINT business_claims_method_check
  CHECK (method IN ('phone_otp', 'email_otp', 'cac_lookup', 'documents', 'unverified'));
