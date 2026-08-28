-- Same bug as 20260828000000, on the store app's side: the original
-- 20260827000000 scaffolding migration never backfilled a
-- better_auth_accounts row for customers who signed up with email+password
-- before Better Auth shipped. 23 real customers confirmed live with a
-- password_hash but no 'credential' account row -- every one of them
-- locked out of password sign-in with "invalid email or password" until
-- this backfill runs. See 20260828000000 for the full explanation.

INSERT INTO better_auth_accounts (user_id, issuer, account_id, provider_id, password, created_at, updated_at)
SELECT c.id, 'local:credential', c.id::text, 'credential', c.password_hash, now(), now()
FROM customers c
WHERE c.password_hash IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM better_auth_accounts a
  WHERE a.user_id = c.id AND a.provider_id = 'credential'
);
