-- The original Better Auth scaffolding migrations (20260827000000/3) never
-- backfilled a dashboard_better_auth_accounts/better_auth_accounts row for
-- users/customers who signed up with email+password BEFORE Better Auth
-- shipped -- only a fresh signInEmail-through-Better-Auth writes one. Every
-- pre-existing password account was left with a real password_hash but no
-- 'credential' account row for signInEmail to check it against, so it
-- correctly (from Better Auth's point of view) rejected every one of them
-- as "invalid email or password" -- a real lockout for 9 dashboard vendors
-- and 23 store customers, confirmed live via a direct count.
--
-- Google accounts don't have this problem: a Google sign-in re-links to the
-- existing user by email on its own (the account-linking flow), self-
-- healing the missing account row the first time someone signs back in.
-- Password sign-in has no equivalent "the password matched, so let me
-- create the account row now" path -- the row has to already exist.
--
-- issuer/account_id/provider_id match exactly what Better Auth itself
-- writes for a real credential signup (confirmed by inspecting a fresh
-- account's own row): issuer 'local:credential', account_id the user's own
-- id, provider_id 'credential'.

INSERT INTO dashboard_better_auth_accounts (user_id, issuer, account_id, provider_id, password, created_at, updated_at)
SELECT u.id, 'local:credential', u.id::text, 'credential', u.password_hash, now(), now()
FROM users u
WHERE u.password_hash IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM dashboard_better_auth_accounts a
  WHERE a.user_id = u.id AND a.provider_id = 'credential'
);
