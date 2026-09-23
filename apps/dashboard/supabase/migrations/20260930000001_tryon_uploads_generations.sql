-- AI Try-On data model: a customer's uploaded photo (tryon_uploads) and
-- each attempt to composite a product onto it (tryon_generations). Split
-- into two tables so the purge job can delete the source photo's R2
-- object even if generation never completes, and so one upload could
-- later back multiple generations against different products.

-- Widen legal_acceptances' document CHECK to add the new consent type --
-- no precedent in this table's history for adding a document type
-- incrementally (all four existing values were created together), so
-- this drops and recreates the constraint rather than altering it in place.
ALTER TABLE legal_acceptances DROP CONSTRAINT legal_acceptances_document_check;
ALTER TABLE legal_acceptances ADD CONSTRAINT legal_acceptances_document_check
  CHECK (document IN ('terms_of_service', 'privacy_policy', 'vendor_agreement', 'vendor_kyc_policy', 'ai_tryon_terms'));

CREATE TABLE tryon_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content_length INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'deleted')),
  -- Nullable + ON DELETE SET NULL: never let a privacy-table cleanup
  -- cascade into deleting legal/audit history, or vice versa.
  consent_legal_acceptance_id UUID REFERENCES legal_acceptances(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tryon_uploads_expiry ON tryon_uploads(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tryon_uploads_customer ON tryon_uploads(customer_id);
ALTER TABLE tryon_uploads ENABLE ROW LEVEL SECURITY;

CREATE TABLE tryon_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES tryon_uploads(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'expired')),
  model VARCHAR(100) NOT NULL,
  result_r2_key TEXT,
  error_message TEXT,
  openrouter_request_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tryon_generations_customer ON tryon_generations(customer_id);
CREATE INDEX idx_tryon_generations_expiry ON tryon_generations(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tryon_generations_status ON tryon_generations(status) WHERE status IN ('queued', 'processing');
ALTER TABLE tryon_generations ENABLE ROW LEVEL SECURITY;
