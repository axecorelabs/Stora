-- account_id relaxed to nullable -- an admin-provisioned sponsor (booked
-- directly with us, filled in while creating a campaign -- see
-- handleAdminStartCampaign in src/index.js) has no self-serve advertiser
-- account to attach to. SQLite can't ALTER a column's NOT NULL in place,
-- so this follows the same drop+recreate pattern 0007_ad_slots.sql
-- already used for this exact table; confirmed empty (0 rows) before
-- this migration, so a straight drop+recreate is safe here (no data to
-- carry across).
DROP TABLE ads;
CREATE TABLE ads (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
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

CREATE INDEX idx_ads_account ON ads (account_id, created_at);
CREATE INDEX idx_ads_slot_status ON ads (slot, status, ends_at);
