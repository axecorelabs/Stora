-- Widen legal_acceptances' document CHECK to add the claim-flow consent
-- type -- recorded when a claimant successfully verifies control of a
-- business's listed email and the claim is finalized (see
-- apps/dashboard/src/app/api/claims/[storeId]/verify/route.js).
ALTER TABLE legal_acceptances DROP CONSTRAINT legal_acceptances_document_check;
ALTER TABLE legal_acceptances ADD CONSTRAINT legal_acceptances_document_check
  CHECK (document IN ('terms_of_service', 'privacy_policy', 'vendor_agreement', 'vendor_kyc_policy', 'ai_tryon_terms', 'business_claim_attestation'));
