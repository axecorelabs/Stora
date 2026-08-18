-- fn_inventory_stats was still live on its pre-variant-unification body
-- (referencing inventory.stock_quantity/cost/base_price), even though
-- 20260817000002_variant_only_rpcs.sql already contains a corrected
-- version that rolls up from inventory_variants -- that file appears to
-- have never actually been applied to this database (its other functions
-- were, per fn_reserve_stock etc. already working; this one specifically
-- wasn't). 20260817000003 then dropped those columns entirely, breaking
-- this function outright ("column i.cost does not exist" on every
-- /api/inventory/stats call since). Re-applying the already-correct body
-- here as its own forward migration rather than editing the old file,
-- which stays a historical record of what should have run.

CREATE OR REPLACE FUNCTION fn_inventory_stats(p_user_id uuid, p_list_limit integer DEFAULT 50)
 RETURNS TABLE(total_items integer, total_stock_units bigint, total_stock_value numeric, total_selling_value numeric, active_items integer, low_stock_count integer, out_of_stock_count integer, category_stats jsonb, low_stock_items jsonb, out_of_stock_items jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_categories JSONB;
  v_low_stock JSONB;
  v_out_of_stock JSONB;
BEGIN
  -- Per-product rollup of its variants, computed once and reused by every
  -- section below.
  CREATE TEMP TABLE tmp_product_rollup ON COMMIT DROP AS
  SELECT
    i.id, i.name, i.sku, i.category, i.is_active, i.minimum_stock,
    COALESCE(SUM(v.quantity_in_stock), 0)::INTEGER AS stock_quantity,
    COALESCE(SUM(v.quantity_in_stock * COALESCE(v.cost_price, 0)), 0) AS stock_value,
    COALESCE(SUM(v.quantity_in_stock * COALESCE(v.price, 0)), 0) AS selling_value
  FROM inventory i
  JOIN inventory_variants v ON v.inventory_id = i.id
  WHERE i.user_id = p_user_id
  GROUP BY i.id, i.name, i.sku, i.category, i.is_active, i.minimum_stock;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category', category_name, 'count', cnt, 'totalStock', total_stock, 'totalValue', total_value
    )), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT COALESCE(category, 'Uncategorized') AS category_name, COUNT(*) AS cnt,
           SUM(stock_quantity) AS total_stock, SUM(stock_value) AS total_value
    FROM tmp_product_rollup
    GROUP BY COALESCE(category, 'Uncategorized')
  ) cat;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sku', sku, 'category', category,
      'stockQuantity', stock_quantity, 'minimumStock', minimum_stock
    )), '[]'::jsonb)
  INTO v_low_stock
  FROM (
    SELECT id, name, sku, category, stock_quantity, minimum_stock
    FROM tmp_product_rollup
    WHERE stock_quantity > 0 AND stock_quantity <= COALESCE(minimum_stock, 5)
    ORDER BY stock_quantity ASC
    LIMIT p_list_limit
  ) lo;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sku', sku, 'category', category, 'stockQuantity', stock_quantity
    )), '[]'::jsonb)
  INTO v_out_of_stock
  FROM (
    SELECT id, name, sku, category, stock_quantity
    FROM tmp_product_rollup
    WHERE stock_quantity <= 0
    LIMIT p_list_limit
  ) oos;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(stock_quantity), 0)::BIGINT,
    COALESCE(SUM(stock_value), 0)::NUMERIC,
    COALESCE(SUM(selling_value), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE is_active)::INTEGER,
    COUNT(*) FILTER (WHERE stock_quantity > 0 AND stock_quantity <= COALESCE(minimum_stock, 5))::INTEGER,
    COUNT(*) FILTER (WHERE stock_quantity <= 0)::INTEGER,
    v_categories, v_low_stock, v_out_of_stock
  FROM tmp_product_rollup;
END;
$function$;
