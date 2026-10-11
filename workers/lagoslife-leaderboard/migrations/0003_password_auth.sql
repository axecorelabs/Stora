-- Swapping email+code login for plain email+password -- avoids needing an
-- email-sending service (Resend) at all for now. login_codes is no longer
-- used by any route; dropped rather than left as dead weight.
DROP TABLE IF EXISTS login_codes;

ALTER TABLE accounts ADD COLUMN password_hash TEXT;
ALTER TABLE accounts ADD COLUMN password_salt TEXT;
