-- Add password reset token fields to users, mirroring the existing
-- email_verification_token/email_verification_expiry pattern.
ALTER TABLE users
  ADD COLUMN password_reset_token VARCHAR(255),
  ADD COLUMN password_reset_expiry TIMESTAMPTZ;
