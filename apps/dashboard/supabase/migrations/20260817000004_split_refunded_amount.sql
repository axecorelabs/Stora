-- The refund route (apps/dashboard/src/app/api/orders/[id]/refund/route.js)
-- already computes the exact amount refunded for a vendor's own split
-- (capped at net_amount_to_vendor, since the platform commission is
-- non-refundable) -- it just never persisted that figure anywhere, only
-- flipping split.status to 'reversed' and folding the dollar amount into
-- order_payments.refund_amount, which is a single cumulative total shared
-- across every vendor's split on a multi-vendor order. That made the
-- Payments page's per-vendor "total refunded" stat unable to tell a partial
-- refund from a full one on a multi-vendor order, so it fell back to
-- approximating with the split's full gross_amount (documented as exact
-- only for the common single-vendor/full-refund case).
ALTER TABLE order_payment_splits ADD COLUMN refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0
  CHECK (refunded_amount >= 0);

-- Backfill for splits reversed before this column existed -- their exact
-- historical refund amount was never recorded (that's the bug this
-- migration fixes), so net_amount_to_vendor (the refundable ceiling the
-- refund route itself enforces) is the best available estimate: exact for
-- the common case, and already strictly more accurate than gross_amount
-- (which wrongly includes the non-refundable commission).
UPDATE order_payment_splits SET refunded_amount = net_amount_to_vendor WHERE status = 'reversed';
