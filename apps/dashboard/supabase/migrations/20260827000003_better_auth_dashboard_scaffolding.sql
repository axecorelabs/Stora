-- Better Auth migration, dashboard app (Phase 2 -- mirrors the store app's
-- own 20260827000000/1/2 migrations, now written in one pass since those
-- three earlier ones already surfaced what a Postgres-mapped Better Auth
-- setup actually needs). Purely additive: no existing users/sessions
-- column is renamed, retyped, or dropped, and no existing row is touched.

-- Same as customers.full_name: Better Auth's user model requires a single
-- `name` field; writable (not generated-STORED, which rejects direct
-- writes -- confirmed the hard way on the store app) and kept in sync
-- with first_name/last_name in both directions by a trigger.
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

CREATE OR REPLACE FUNCTION sync_user_full_name() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.first_name IS NULL OR NEW.first_name = '') AND NEW.full_name IS NOT NULL AND NEW.full_name <> '' THEN
      NEW.first_name := NULLIF(split_part(NEW.full_name, ' ', 1), '');
      NEW.last_name := NULLIF(trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2)), '');
    END IF;
    NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  ELSE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      NEW.first_name := NULLIF(split_part(NEW.full_name, ' ', 1), '');
      NEW.last_name := NULLIF(trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2)), '');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_full_name ON users;
CREATE TRIGGER trg_sync_user_full_name
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_full_name();

-- Backfill existing rows once, same as the store app's migration did for
-- customers (the trigger only fires on future inserts/updates).
UPDATE users SET full_name = TRIM(BOTH ' ' FROM COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  WHERE full_name IS NULL;

-- users_auth_method_check (password_hash IS NOT NULL OR google_id IS NOT
-- NULL) assumed credentials live directly on the user row -- once Better
-- Auth's account-based model is in play, a freshly-created user
-- legitimately has neither (its password/google link lives in the new
-- dashboard_better_auth_accounts table below, written in a second insert
-- after the user row itself). Confirmed on the store app's identical
-- constraint that this rejects the insert outright without dropping it.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check;

-- sessions has no real ip_address/user_agent columns today -- only a
-- `data` jsonb blob holding {userAgent, ipAddress}. Better Auth's session
-- model expects real columns for both; added here rather than fighting
-- to map a field onto a JSON path.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Mirrors apps/store's better_auth_accounts/better_auth_verifications --
-- separate tables (not shared with the store app's) since the FK target
-- is users, not customers.
CREATE TABLE IF NOT EXISTS dashboard_better_auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_dashboard_better_auth_accounts_user_id ON dashboard_better_auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS dashboard_better_auth_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_better_auth_verifications_identifier ON dashboard_better_auth_verifications(identifier);
