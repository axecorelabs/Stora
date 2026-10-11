-- Self-serve paid ads. starts_at/ends_at are set at APPROVAL time, not at
-- payment time -- so review latency never eats into the duration someone
-- paid for. image_key follows the same R2 object-storage convention as
-- avatars/screenshots (see src/r2.js).
CREATE TABLE ads (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  image_key TEXT NOT NULL,
  image_content_type TEXT NOT NULL,
  link_url TEXT NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('day', 'week', 'month')),
  amount_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'pending_review', 'active', 'rejected', 'expired')),
  paystack_reference TEXT,
  starts_at INTEGER,
  ends_at INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  rejection_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_ads_account ON ads (account_id, created_at);
-- Backs both the admin pending-review list and the public active-ads query.
CREATE INDEX idx_ads_status_ends_at ON ads (status, ends_at);
