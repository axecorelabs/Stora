-- Audit trail of who accepted which legal document, when, from where.
-- Nothing in the codebase persisted this before now: SignUpModal.js/SignUp.js
-- both collect an agreeToTerms checkbox client-side, but the store's
-- register route drops the value after validating it's true, and the
-- dashboard's signup route never even validates it server-side. The one
-- existing precedent, vendor_verifications.consent_given_at, is a single
-- timestamp column scoped to one specific consent (NIN/selfie sharing with
-- QoreID) on one business record -- fine for that narrow case, but not a
-- general answer for "prove any user accepted any document."
--
-- actor_id has no FK constraint (unlike every other reference in this
-- schema) because it points at either customers.id or users.id depending
-- on actor_type -- Postgres foreign keys can't conditionally target one of
-- two tables. Every write path controls actor_type itself (never
-- client-supplied), so this is the one place in the schema deliberately
-- trading referential-integrity enforcement for the flexibility of one
-- shared table across both user types instead of two near-identical ones.
CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('customer', 'vendor_user')),
  actor_id UUID NOT NULL,
  document VARCHAR(30) NOT NULL CHECK (document IN (
    'terms_of_service', 'privacy_policy', 'vendor_agreement', 'vendor_kyc_policy'
  )),
  -- The document's own "Last updated" date (e.g. '2026-09-04'), not an
  -- internal counter -- lets a future re-acceptance flow query "who
  -- accepted a version older than the current one" directly against the
  -- same date already printed on the page.
  document_version VARCHAR(20) NOT NULL,
  -- Where this acceptance was captured -- 'signup', 'kyc_verification', and
  -- room for e.g. 'reacceptance' later without a schema change.
  context VARCHAR(30) NOT NULL,
  ip_address VARCHAR(100),
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_legal_acceptances_actor ON legal_acceptances(actor_type, actor_id);
CREATE INDEX idx_legal_acceptances_document ON legal_acceptances(document);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
