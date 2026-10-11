-- Switches pricing from fixed day/week/month packages to a flat
-- per-day rate (affordable "nudge" pricing, not a subscription
-- decision) -- any number of days the advertiser picks, priced
-- linearly. Table is empty (feature shipped minutes ago, confirmed via
-- a live count before writing this migration), so a clean rebuild
-- rather than an in-place column migration.
DROP TABLE social_unlocks;
CREATE TABLE social_unlocks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  days INTEGER NOT NULL CHECK (days >= 1 AND days <= 90),
  amount_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid')),
  paystack_reference TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_social_unlocks_account ON social_unlocks (account_id, created_at);
