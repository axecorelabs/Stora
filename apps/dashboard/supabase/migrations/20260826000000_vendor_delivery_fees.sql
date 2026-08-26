-- Lets a vendor charge for delivery: a flat fee per destination state
-- (Lagos != Kano, but fixed within a state -- no distance/weight math),
-- and a choice of who collects it. 'platform_collected' means the fee is
-- charged through Paystack alongside the merchandise, same payment,
-- same as today's (currently dead) orders.shipping_fee column was always
-- meant to support. 'pay_on_delivery' means the rider collects the fee
-- in cash/transfer on arrival -- merchandise payment is unaffected
-- either way, only the delivery-fee portion moves off-platform.
--
-- JSONB keyed by state value (matching NIGERIAN_STATES/STATE_TO_ZONE
-- exactly, e.g. 'Lagos', 'FCT') rather than a join table: bounded at 37
-- keys per vendor, never queried cross-vendor, and every call site that
-- needs it already fetches a single stores row/batch by id -- mirrors
-- the existing bank_details JSONB precedent.
ALTER TABLE stores ADD COLUMN delivery_fees JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stores ADD COLUMN fulfillment_method VARCHAR(20) NOT NULL DEFAULT 'platform_collected'
  CHECK (fulfillment_method IN ('platform_collected', 'pay_on_delivery'));

-- order_payment_splits snapshots the resolved fee and the *effective*
-- method actually used for this order at checkout time -- same
-- "never retroactively changes a past order" policy as commission_bearer.
-- delivery_fee_amount holds the full raw fee regardless of method (the
-- dashboard's order-details page needs it to show "customer owes you
-- NGN X on delivery" even though it never entered customer_amount for a
-- pay_on_delivery split).
ALTER TABLE order_payment_splits ADD COLUMN delivery_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0
  CHECK (delivery_fee_amount >= 0);
ALTER TABLE order_payment_splits ADD COLUMN fulfillment_method VARCHAR(20) NOT NULL DEFAULT 'platform_collected'
  CHECK (fulfillment_method IN ('platform_collected', 'pay_on_delivery'));

-- No backfill needed -- every existing split row predates delivery fees
-- entirely, so 0/'platform_collected' is already correct history.

NOTIFY pgrst, 'reload schema';
