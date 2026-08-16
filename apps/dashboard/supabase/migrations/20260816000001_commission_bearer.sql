-- Lets a vendor choose whether THEY absorb the platform commission
-- (today's only behavior -- customer pays gross_amount, vendor nets
-- gross_amount - commission) or pass it to the customer as a surcharge
-- (customer pays gross_amount + commission, vendor nets the full
-- gross_amount). Defaults to 'vendor' so every existing store keeps
-- today's exact behavior with no action needed.
ALTER TABLE stores ADD COLUMN commission_bearer VARCHAR(20) NOT NULL DEFAULT 'vendor'
  CHECK (commission_bearer IN ('vendor', 'customer'));

-- order_payment_splits snapshots the bearer mode and the actual amount
-- charged to the customer for this vendor's share, captured at checkout
-- time -- if a vendor later flips their toggle, past orders must not
-- retroactively change. gross_amount keeps meaning "the listed subtotal
-- before commission" either way; customer_amount is what the customer was
-- actually charged for this vendor's line (equal to gross_amount when the
-- vendor bears it, gross_amount + commission when the customer does).
-- net_amount_to_vendor already means "what the vendor keeps" in both
-- modes, and -- by the same policy applied in both directions ("the
-- platform commission is never refunded, regardless of who nominally
-- paid it") -- it also already equals the correct refundable ceiling in
-- both modes, so the refund route (apps/dashboard/src/app/api/orders/[id]/refund/route.js)
-- needs no changes for this feature.
ALTER TABLE order_payment_splits ADD COLUMN commission_bearer VARCHAR(20) NOT NULL DEFAULT 'vendor'
  CHECK (commission_bearer IN ('vendor', 'customer'));
ALTER TABLE order_payment_splits ADD COLUMN customer_amount DECIMAL(12,2) NOT NULL DEFAULT 0
  CHECK (customer_amount >= 0);

-- Every existing row predates this feature -- all of them were
-- vendor-bears (the only mode that ever existed), so customer_amount for
-- historical rows is gross_amount, not the 0 the column default would
-- otherwise leave them at.
UPDATE order_payment_splits SET customer_amount = gross_amount;
