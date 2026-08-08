-- sales rows can originate from two places: POS (cash/transfer/card/credit/pos/other)
-- and order-derived sales created when an order is marked delivered, which copies
-- order_payments.method verbatim (card/bank_transfer/cash_to_vendor/wallet/paystack/flutterwave).
-- The original CHECK only covered the POS set, breaking every order-to-sale conversion
-- for a non-POS payment method.

ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN (
  'cash','transfer','card','credit','pos','other',
  'bank_transfer','cash_to_vendor','wallet','paystack','flutterwave'
));
