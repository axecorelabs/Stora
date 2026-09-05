-- "What does your business do" becomes a non-exclusive set at business-
-- creation time (Products / Food / Services), not a single storeType pick
-- plus a bolted-on restaurant-mode toggle discovered after the fact. A
-- business can be a restaurant that also does catering (Food + Services),
-- or a pure services business with no product catalog at all.
--
-- restaurant_mode is left exactly as-is (not renamed to offers_food) --
-- it's consumed as a plain boolean in 9 places across both apps
-- (transformStore(), dashboard inventory/header/settings UI, apps/store's
-- ProductsPageClient.js/supabaseStore.js); renaming buys nothing here and
-- widens the diff for no reason. sells_products defaults to true so every
-- existing store (all of which sell products today) is grandfathered in
-- correctly with no backfill needed.
ALTER TABLE stores ADD COLUMN sells_products BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE stores ADD COLUMN offers_services BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
