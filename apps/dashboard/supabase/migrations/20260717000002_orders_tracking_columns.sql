-- Real order tracking fields found in live Mongo data and referenced by
-- ivma-app order routes, missed in the initial schema pass.

ALTER TABLE orders
  ADD COLUMN tracking_carrier VARCHAR(100),
  ADD COLUMN tracking_number VARCHAR(100),
  ADD COLUMN estimated_delivery TIMESTAMPTZ;
