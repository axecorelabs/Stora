-- One delivery schedule per sale -- POST /api/deliveries had no
-- uniqueness guard at all, so two near-simultaneous requests for the same
-- sale (a double-click, two POS sessions on the same shared login) could
-- create two independent delivery_schedules rows, two status-history
-- trails, and (if a customer email was on file) two notification emails.
-- Partial (WHERE sale_id IS NOT NULL) since sale_id is nullable and a
-- delivery with no linked sale has nothing to be unique against.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_schedules_sale_id_unique
  ON delivery_schedules(sale_id)
  WHERE sale_id IS NOT NULL;
