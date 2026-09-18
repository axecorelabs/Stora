-- Allow manual (offline) listing subscription activation records,
-- alongside existing paystack-driven records.

ALTER TABLE listing_subscriptions
  DROP CONSTRAINT IF EXISTS listing_subscriptions_provider_check;

ALTER TABLE listing_subscriptions
  ADD CONSTRAINT listing_subscriptions_provider_check
  CHECK (provider IN ('paystack', 'manual'));

ALTER TABLE listing_subscription_transactions
  DROP CONSTRAINT IF EXISTS listing_subscription_transactions_provider_check;

ALTER TABLE listing_subscription_transactions
  ADD CONSTRAINT listing_subscription_transactions_provider_check
  CHECK (provider IN ('paystack', 'manual'));

NOTIFY pgrst, 'reload schema';
