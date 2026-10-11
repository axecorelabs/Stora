-- Real per-person admin accounts + RBAC, replacing the single shared
-- ADMIN_SECRET Basic-Auth credential for day-to-day use (that secret
-- becomes a one-time bootstrap credential only -- see handleAdminSetup
-- in src/index.js). Same session-cookie shape as the public accounts
-- table (migrations/0002_accounts.sql) -- separate table/cookie so an
-- admin session and a public leaderboard-account session never collide.
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'agent', 'investor')),
  disabled_at INTEGER,
  created_by TEXT REFERENCES admin_users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_admin_users_email ON admin_users (email);

CREATE TABLE admin_sessions (
  token TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions (admin_user_id);
