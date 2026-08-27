-- Better Auth migration, store app (Phase 1 of 2 -- see the "Migrate to
-- Better Auth" plan). Purely additive: no existing column is renamed,
-- retyped, or dropped, and no existing customers/customer_sessions row is
-- touched. Better Auth's `user`/`session` models are mapped (via its own
-- `fields`/`modelName` config, not here) directly onto the existing
-- customers/customer_sessions tables -- this migration only adds what
-- those existing tables have no equivalent column for.

-- Better Auth's user model requires a single required `name` field; this
-- app's customers table has always split that into first_name/last_name.
-- A generated column keeps a Better Auth-compatible `name` in sync
-- automatically -- no application code has to maintain it, and updating
-- first_name/last_name (already done throughout this app) keeps working
-- unchanged.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name TEXT
  GENERATED ALWAYS AS (TRIM(BOTH ' ' FROM COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED;

-- Better Auth's `account` model: one row per linked auth method (Google,
-- and -- once Phase 2 below lands -- the credential/password method
-- too), keyed by (issuer, accountId). This replaces the current
-- `customers.google_id` column/`password_hash`-on-user approach with
-- Better Auth's own normalized shape; existing google_id values are
-- backfilled into this table once the store app's auth code actually
-- cuts over (a follow-up step, not part of this schema-only migration).
CREATE TABLE IF NOT EXISTS better_auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issuer, account_id)
);
CREATE INDEX IF NOT EXISTS idx_better_auth_accounts_user_id ON better_auth_accounts(user_id);

-- Better Auth's `verification` model: short-lived identifier/value pairs
-- (email-OTP codes, password-reset tokens once Phase 2 moves those over
-- from customers.verification_token/password_reset_token). Not reusing
-- temp_users/the existing token columns since Better Auth's own OTP
-- plugin reads/writes this exact shape itself.
CREATE TABLE IF NOT EXISTS better_auth_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_better_auth_verifications_identifier ON better_auth_verifications(identifier);
