-- Adds slot + campaign_id, and widens `package` to allow 'campaign' (the
-- campaign_banner slot's flat per-campaign fee, vs. the day/week/month
-- duration the other slots sell). SQLite can't ALTER a CHECK constraint
-- directly, so this follows SQLite's own documented pattern for that:
-- build the new shape, copy rows across, swap names.
CREATE TABLE ads_new (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  -- Which position on the page this ad is buying. campaign_banner ads
  -- also carry campaign_id (which specific campaign they sponsor); the
  -- other three slots leave it NULL.
  slot TEXT NOT NULL DEFAULT 'ranking_top'
    CHECK (slot IN ('ranking_top', 'ranking_bottom', 'profile_tab', 'campaign_banner')),
  campaign_id TEXT REFERENCES campaigns(id),
  image_key TEXT NOT NULL,
  image_content_type TEXT NOT NULL,
  link_url TEXT NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('day', 'week', 'month', 'campaign')),
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

INSERT INTO ads_new (
  id, account_id, slot, campaign_id, image_key, image_content_type, link_url, package,
  amount_kobo, status, paystack_reference, starts_at, ends_at, reviewed_by, reviewed_at,
  rejection_reason, created_at, updated_at
)
SELECT
  id, account_id, 'ranking_top', NULL, image_key, image_content_type, link_url, package,
  amount_kobo, status, paystack_reference, starts_at, ends_at, reviewed_by, reviewed_at,
  rejection_reason, created_at, updated_at
FROM ads;

DROP TABLE ads;
ALTER TABLE ads_new RENAME TO ads;

CREATE INDEX idx_ads_account ON ads (account_id, created_at);
-- Backs both the per-slot active-ads query and the capacity-at-purchase check.
CREATE INDEX idx_ads_slot_status ON ads (slot, status, ends_at);
