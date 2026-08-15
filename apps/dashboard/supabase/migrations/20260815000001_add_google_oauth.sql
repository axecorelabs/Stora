-- Google OAuth support: a user/customer row can now be authenticated by
-- Google identity alone (no local password), so password_hash must become
-- nullable. The CHECK constraint keeps every row auth-capable by at least
-- one method (mirrors the NOT NULL guarantee it replaces).

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_id VARCHAR(255) UNIQUE;

ALTER TABLE users
  ADD CONSTRAINT users_auth_method_check
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);

ALTER TABLE customers
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_id VARCHAR(255) UNIQUE;

ALTER TABLE customers
  ADD CONSTRAINT customers_auth_method_check
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);
