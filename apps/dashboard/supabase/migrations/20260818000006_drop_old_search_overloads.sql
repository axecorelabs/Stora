-- 20260818000005 added p_state/p_buyer_state to search_products/search_vendors
-- via CREATE OR REPLACE -- but CREATE OR REPLACE only replaces a function
-- with the *exact same* parameter list. Since the parameter list changed,
-- Postgres created a second, overloaded version instead of replacing the
-- old one, leaving both live at once. PostgREST then can't always
-- disambiguate which to call (confirmed via a live 'Could not choose the
-- best candidate function' error on search_vendors, and silent-wrong-
-- overload risk on search_products, which was actually returning
-- unfiltered results).
--
-- Turns out this was a latent bug from 20260818000003 too (the price-
-- filter/vendor-category migration also changed these functions'
-- parameter lists the same way) -- querying pg_proc directly after this
-- migration's first version revealed a THIRD, even older signature still
-- live for both functions. Drop every prior signature explicitly so
-- exactly one version of each exists, rather than assuming there's only
-- one prior generation to clean up.

DROP FUNCTION IF EXISTS search_products(TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS search_products(TEXT, TEXT, TEXT, INT, INT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS search_vendors(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS search_vendors(TEXT, TEXT, INT, INT, TEXT);
