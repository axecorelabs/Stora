-- Single round-trip inventory stats aggregate, replacing the full-table
-- select('*') + JS reduce/filter in
-- apps/dashboard/src/app/api/inventory/stats/route.js. Totals and the
-- category breakdown are computed over ALL matching rows (never truncated);
-- the two display lists (low/out-of-stock) are capped at p_list_limit since
-- they're for UI display, not full data dumps -- their counts in the
-- numeric summary are computed separately and stay exact even when the
-- lists are capped.
--
-- This has to be a SQL function, not a supabase-js filter chain: the
-- low-stock condition (stock_quantity > 0 AND stock_quantity <=
-- minimum_stock) is a column-to-column comparison, which PostgREST's query
-- builder cannot express (.lte('stock_quantity', 'minimum_stock') would
-- compare against the literal string 'minimum_stock', not the column).

CREATE OR REPLACE FUNCTION fn_inventory_stats(p_user_id UUID, p_list_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  total_items INTEGER,
  total_stock_units BIGINT,
  total_stock_value NUMERIC,
  total_selling_value NUMERIC,
  active_items INTEGER,
  low_stock_count INTEGER,
  out_of_stock_count INTEGER,
  category_stats JSONB,
  low_stock_items JSONB,
  out_of_stock_items JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_categories JSONB;
  v_low_stock JSONB;
  v_out_of_stock JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category', category_name, 'count', cnt, 'totalStock', total_stock, 'totalValue', total_value
    )), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT COALESCE(category, 'Uncategorized') AS category_name, COUNT(*) AS cnt,
           COALESCE(SUM(stock_quantity), 0) AS total_stock,
           COALESCE(SUM(stock_quantity * cost), 0) AS total_value
    FROM inventory WHERE user_id = p_user_id
    GROUP BY COALESCE(category, 'Uncategorized')
  ) cat;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sku', sku, 'category', category,
      'stockQuantity', stock_quantity, 'minimumStock', minimum_stock
    )), '[]'::jsonb)
  INTO v_low_stock
  FROM (
    SELECT id, name, sku, category, stock_quantity, minimum_stock
    FROM inventory
    WHERE user_id = p_user_id AND stock_quantity > 0 AND stock_quantity <= COALESCE(minimum_stock, 5)
    ORDER BY stock_quantity ASC
    LIMIT p_list_limit
  ) lo;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'sku', sku, 'category', category, 'stockQuantity', stock_quantity
    )), '[]'::jsonb)
  INTO v_out_of_stock
  FROM (
    SELECT id, name, sku, category, stock_quantity
    FROM inventory
    WHERE user_id = p_user_id AND COALESCE(stock_quantity, 0) <= 0
    ORDER BY updated_at DESC
    LIMIT p_list_limit
  ) oos;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(i.stock_quantity), 0)::BIGINT,
    COALESCE(SUM(i.stock_quantity * i.cost), 0)::NUMERIC,
    COALESCE(SUM(i.stock_quantity * i.base_price), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE i.is_active)::INTEGER,
    COUNT(*) FILTER (WHERE i.stock_quantity > 0 AND i.stock_quantity <= COALESCE(i.minimum_stock, 5))::INTEGER,
    COUNT(*) FILTER (WHERE COALESCE(i.stock_quantity, 0) <= 0)::INTEGER,
    v_categories, v_low_stock, v_out_of_stock
  FROM inventory i
  WHERE i.user_id = p_user_id;
END;
$$;
