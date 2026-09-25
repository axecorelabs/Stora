-- Which of the listing plan's 3 cycles a vendor is on -- previously
-- untracked anywhere (the whole subscription system assumed monthly).
-- Nullable: a store with subscription_status='none' has no cycle to
-- report, same nullability as subscription_paystack_code/
-- subscription_next_payment_date already have for that state. Full-store
-- (full_store_*) is explicitly out of scope -- stays monthly-only.
ALTER TABLE stores ADD COLUMN subscription_billing_cycle VARCHAR(10)
  CHECK (subscription_billing_cycle IN ('monthly', '6month', 'annual'));

ALTER TABLE listing_subscriptions ADD COLUMN billing_cycle VARCHAR(10)
  CHECK (billing_cycle IN ('monthly', '6month', 'annual'));

ALTER TABLE listing_subscription_transactions ADD COLUMN billing_cycle VARCHAR(10)
  CHECK (billing_cycle IN ('monthly', '6month', 'annual'));
