-- Which of the full-store plan's 4 cycles a vendor is on -- same pattern
-- as 20260930000014's listing equivalent, now extended to full-store
-- alongside its new 3-month/6-month/annual tiers. Nullable: a store with
-- full_store_subscription_status='none' has no cycle to report.
ALTER TABLE stores ADD COLUMN full_store_subscription_billing_cycle VARCHAR(10)
  CHECK (full_store_subscription_billing_cycle IN ('monthly', '3month', '6month', 'annual'));

ALTER TABLE full_store_subscriptions ADD COLUMN billing_cycle VARCHAR(10)
  CHECK (billing_cycle IN ('monthly', '3month', '6month', 'annual'));

ALTER TABLE full_store_subscription_transactions ADD COLUMN billing_cycle VARCHAR(10)
  CHECK (billing_cycle IN ('monthly', '3month', '6month', 'annual'));
