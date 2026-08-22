-- Records how much of order_payments.amount was Paystack's own processing
-- fee (customer-borne, computed by apps/store/src/lib/... via the shared
-- estimatePaystackFee in packages/shared-constants/checkoutFees.js) as
-- opposed to the actual order value. Purely for transparency/reconciliation
-- (e.g. comparing this estimate against Paystack's real `data.fees` on a
-- confirmed transaction to catch drift -- an international card, or a
-- future Paystack pricing change) -- nothing in the payment-confirmation
-- path depends on it.
ALTER TABLE order_payments ADD COLUMN estimated_paystack_fee DECIMAL(12,2) DEFAULT 0;
