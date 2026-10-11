-- Paid perk: shows an account's social handles (Instagram/TikTok/X)
-- next to ANY of their approved leaderboard entries (podium card, list
-- row) for a chosen duration -- account-level and rank-agnostic, since
-- rank fluctuates as new entries come in, so tying this to "podium
-- only" would be awkward to guarantee. Same Paystack pay-then-confirm
-- shape as self-serve ads, just without a review step -- there's no
-- creative to moderate, only an existing account flag to flip.
ALTER TABLE accounts ADD COLUMN social_unlock_ends_at INTEGER;

CREATE TABLE social_unlocks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  package TEXT NOT NULL CHECK (package IN ('day', 'week', 'month')),
  amount_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid')),
  paystack_reference TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_social_unlocks_account ON social_unlocks (account_id, created_at);
