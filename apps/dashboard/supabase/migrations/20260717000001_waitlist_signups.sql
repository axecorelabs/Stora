-- Marketing landing-page waitlist signups. Distinct from the customer
-- wishlists/wishlist_items feature (product wishlist) discovered during
-- data migration — Mongo's "waitlists" collection is unrelated: it's
-- "join our waitlist" signups from the marketing site.

CREATE TABLE waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  business_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','contacted','converted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_waitlist_signups_email ON waitlist_signups(email);
CREATE INDEX idx_waitlist_signups_status ON waitlist_signups(status);

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_waitlist_signups_updated_at BEFORE UPDATE ON waitlist_signups
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
