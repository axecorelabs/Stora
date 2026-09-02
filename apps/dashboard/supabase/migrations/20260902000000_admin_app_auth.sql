-- Auth scaffolding for the new apps/admin app -- Stora-internal staff
-- accounts, deliberately a completely separate identity from the vendor
-- `users` table (no shared login, no shared role column). Built
-- Better-Auth-native from the start (unlike users/sessions, which needed
-- a retrofit migration to bolt Better Auth onto a pre-existing shape) --
-- these tables have never existed before, so there's nothing to migrate
-- around.
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  -- Accounts are always staff-provisioned (by another admin, or the
  -- one-time bootstrap script for the very first account) -- there is no
  -- public signup to verify against, so every row is trusted by
  -- construction.
  email_verified BOOLEAN NOT NULL DEFAULT true,
  image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);

-- Better Auth's credential (email+password) provider stores the hashed
-- password here, one row per auth method per user -- not a column on
-- admin_users itself, same reason apps/dashboard's own
-- dashboard_better_auth_accounts table exists for vendor accounts.
CREATE TABLE admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  -- Better Auth's account model expects this column under its own literal
  -- (unmapped) name -- confirmed live: account creation 500s with "column
  -- issuer does not exist" without it. Mirrors
  -- dashboard_better_auth_accounts's own `issuer` column exactly.
  issuer TEXT,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX idx_admin_accounts_user_id ON admin_accounts(user_id);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;

-- Correction: these two columns (added in 20260901000000_partner_campaigns.sql)
-- were built referencing `users` (the vendor table) before the
-- fully-separate-identity decision was made for the admin app. Re-point
-- at admin_users -- safe, no real data references either column yet
-- (that migration's own test data was already cleaned up).
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_partner_designated_by_fkey;
ALTER TABLE stores ADD CONSTRAINT stores_partner_designated_by_fkey
  FOREIGN KEY (partner_designated_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_created_by_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;
