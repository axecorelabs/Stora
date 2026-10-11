-- At most one row has status='active' at a time (enforced in application
-- logic in src/db.js's startCampaign, not a DB constraint -- SQLite has no
-- clean way to express "at most one row matching X" as a CHECK). Starting
-- a new campaign ends whatever's currently active first, so two campaigns
-- can run back-to-back with zero gap; if nothing new is started after one
-- ends, the platform is simply in a resting "no active campaign" state.
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reward_description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_campaigns_status ON campaigns (status);

-- Nullable: stamps which campaign (if any) was running when a balance was
-- submitted. NULL for submissions made outside any campaign -- those
-- still show up in the resting-state (all-time) leaderboard same as
-- today; this column is provenance, not an exclusion filter, except while
-- a campaign is actively gating the view (see src/index.js).
ALTER TABLE entries ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);
CREATE INDEX idx_entries_campaign ON entries (campaign_id, reported_balance DESC);
-- Backs the "has this account already submitted to this campaign" check.
CREATE INDEX idx_entries_campaign_account ON entries (campaign_id, account_id);
