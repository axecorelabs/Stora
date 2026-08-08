-- 'trial' is a real subscription status/billing_cycle used at signup time
-- (every new user gets a 14-day trial subscription) -- missed in the initial
-- CHECK constraints, which only covered post-trial states.

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN (
  'trial','active','cancelled','expired','paused'
));

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_billing_cycle_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check CHECK (billing_cycle IN (
  'trial','monthly','quarterly','yearly'
));

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check CHECK (plan_type IN (
  'free','basic','premium','enterprise'
));
