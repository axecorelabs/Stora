-- 20260823000000/1 both used CREATE OR REPLACE to add p_deliverable_only,
-- on the mistaken assumption that appending a defaulted parameter is safe
-- for REPLACE -- it isn't. Postgres matches CREATE OR REPLACE against the
-- exact parameter type list; adding one changes that list, so instead of
-- replacing the old function it silently created a second overload
-- alongside it (exactly the failure mode 20260819000000's own comment
-- warned about, for the same reason -- a lesson that migration's TEXT ->
-- TEXT[] change respected and this one didn't). Two live overloads meant
-- PostgREST could resolve a given RPC call to either one depending on
-- which parameters it happened to include, which is what actually
-- explains "no-filter browsing returns nothing, but the delivery filter
-- works" -- not a data or cache issue.
--
-- Drop the old 9-arg overloads explicitly so only the 10-arg
-- (p_deliverable_only-aware) version of each remains.
DROP FUNCTION IF EXISTS search_products(TEXT, TEXT[], TEXT, INT, INT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_vendors(TEXT, TEXT, INT, INT, TEXT[], TEXT, TEXT);

NOTIFY pgrst, 'reload schema';
