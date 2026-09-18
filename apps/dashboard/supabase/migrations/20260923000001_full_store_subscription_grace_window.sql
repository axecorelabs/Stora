-- Full-store grace and lock fields. Allows a short renewal grace period
-- before commerce access/storefront lock is enforced.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS full_store_subscription_grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS full_store_subscription_locked_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
