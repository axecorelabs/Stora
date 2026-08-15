-- order_item_batches was created without RLS enabled (missed when it was
-- added in 20260814000001_stock_reservation_functions.sql). Every other
-- table in the schema has RLS enabled with zero policies, which is a safe
-- deny-all default for anon/authenticated (neither role has BYPASSRLS;
-- only service_role does, which is what both apps exclusively use). This
-- table's default `anon` grants were therefore live and directly
-- reachable over PostgREST using the public anon key. No policies are
-- added here, matching the rest of the schema's default-deny posture.
ALTER TABLE order_item_batches ENABLE ROW LEVEL SECURITY;
