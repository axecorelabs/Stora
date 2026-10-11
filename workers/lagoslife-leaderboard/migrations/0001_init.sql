-- id is a crypto.randomUUID() generated in src/index.js's submit handler
-- BEFORE either the R2 put or this insert -- lets the R2 object key
-- (submissions/<id>.<ext>) and this row share the same identifier without
-- a round trip to get an autoincrement value back first.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  lagos_life_handle TEXT NOT NULL,
  -- Naira. Nowhere near SQLite's 64-bit ceiling -- the CHECK just stops a
  -- troll typing 50 nines from producing a UI-breaking value; the admin
  -- approval queue is the real backstop against a merely-implausible one.
  reported_balance INTEGER NOT NULL CHECK (reported_balance >= 0 AND reported_balance <= 999999999999999),
  screenshot_key TEXT NOT NULL,
  screenshot_content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- sha256(IP_HASH_SALT + ip) via Web Crypto -- never the raw IP.
  submitter_ip_hash TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  rejection_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Backs GET /api/leaderboard's `WHERE status = 'approved' ORDER BY reported_balance DESC`.
CREATE INDEX idx_entries_leaderboard ON entries (status, reported_balance DESC);

-- Backs GET /admin's pending-queue listing, oldest first.
CREATE INDEX idx_entries_pending_queue ON entries (status, created_at);

-- Backs the hourly-submission-count throttle in src/db.js.
CREATE INDEX idx_entries_ip_rate ON entries (submitter_ip_hash, created_at);
