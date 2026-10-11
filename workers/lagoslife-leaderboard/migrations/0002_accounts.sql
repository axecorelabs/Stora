-- Lightweight, Worker-scoped accounts -- deliberately NOT tied to Stora's
-- real customer/vendor login (Better Auth + Supabase). That system is
-- gated by a browser-only Turnstile flow with no server-to-server token
-- path, and a Lagos Life profile isn't really the same thing as being a
-- Stora shopper/vendor anyway. This is its own email+code login, fully
-- self-contained in this D1 database.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  lagos_life_handle TEXT,
  avatar_key TEXT,
  avatar_content_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One pending code per email at a time (PRIMARY KEY on email -- a new
-- request overwrites/replaces the row, invalidating the old code,
-- standard OTP UX). code_hash is sha256(code) -- the plaintext code is
-- never persisted. attempts caps brute-force guessing of a short numeric
-- code before the caller has to request a fresh one.
CREATE TABLE login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Opaque bearer session tokens (not signed JWTs) -- the token itself is
-- the high-entropy secret, verified by a straight D1 lookup. Simpler than
-- reimplementing a signing scheme, and session volume here is low enough
-- that a DB round trip per authenticated request is not a concern.
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sessions_account ON sessions (account_id);

-- Nullable: anonymous submissions (no session at the time) keep working
-- exactly as before. When a logged-in visitor submits, src/index.js
-- stamps this so their Profile tab can show their latest entry without
-- depending on the browser's localStorage id at all.
ALTER TABLE entries ADD COLUMN account_id TEXT REFERENCES accounts(id);
CREATE INDEX idx_entries_account ON entries (account_id, created_at);
