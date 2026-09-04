-- delivery_fee_amount alone can't distinguish "vendor priced delivery to
-- this state at ₦0 (genuinely free)" from "vendor never configured a fee
-- for this state at all" -- both read back as 0. That silently told
-- customers delivery was free when really nobody had priced it yet, with
-- no way for the checkout UI, the vendor's own order view, or this row
-- itself to tell the two apart after the fact.
--
-- delivery_fee_is_set snapshots which of the two was true at checkout time
-- (via resolveDeliveryFee in packages/shared-constants/checkoutFees.js),
-- same "never retroactively changes a past order" policy as
-- delivery_fee_amount/fulfillment_method next to it.
ALTER TABLE order_payment_splits ADD COLUMN delivery_fee_is_set BOOLEAN NOT NULL DEFAULT true;

-- Backfill: every existing split row predates this distinction. A nonzero
-- delivery_fee_amount can only exist if a fee really was configured, so
-- those stay true (the column default). A zero amount is ambiguous in
-- hindsight -- it could be a real free-delivery fee or an unset one -- but
-- defaulting those to true (assume "free, as recorded") preserves the
-- existing, already-communicated history rather than retroactively
-- flagging past orders as having had an undisclosed fee.

NOTIFY pgrst, 'reload schema';
