-- Public "suggest a business" intake (apps/store). Raw and unstructured
-- on purpose -- never inserted directly into `stores`; staff normalize
-- category/location/etc. into a real listing via the admin creation
-- endpoint after reviewing one of these.
CREATE TABLE business_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_name TEXT NOT NULL,
  suggested_category_text TEXT,
  suggested_location_text TEXT,
  submitter_contact TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_suggestions_status ON business_suggestions(status, created_at DESC);
ALTER TABLE business_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE business_suggestions FROM anon, authenticated;
