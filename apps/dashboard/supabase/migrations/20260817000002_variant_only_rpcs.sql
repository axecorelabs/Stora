-- Rewrites every stock-mutation RPC to operate on inventory_variants only,
-- now that 20260817000001_unify_inventory_variants.sql guarantees every
-- product has >=1 variant and every active batch is variant-scoped. Drops
-- the p_inventory_id/p_variant_id-nullable branching each function used
-- to carry -- inventory_id is derivable from the variant when needed
-- (inventory_activities logging), never a separate code path anymore.
--
-- Signatures are changing (not just bodies), so functions whose parameter
-- list changes are explicitly dropped first -- CREATE OR REPLACE cannot
-- change a function's parameter list.

DROP FUNCTION IF EXISTS fn_reserve_stock(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS fn_release_stock_reservation(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS fn_fulfill_stock_reservation(UUID, UUID, INTEGER, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS fn_sell_stock_direct(UUID, UUID, INTEGER, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS fn_create_batch(UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS fn_remove_stock(UUID, UUID, UUID, INTEGER, UUID, TEXT);


-- Reserve stock for a checkout/order line. Same FIFO-walk/locking shape as
-- before, just keyed on variant_id alone -- every product (including
-- "simple" ones) has exactly one variant row when it has no real
-- size/color options, so there's no separate product-level path anymore.
CREATE OR REPLACE FUNCTION fn_reserve_stock(
  p_variant_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  reserved_qty INTEGER,
  shortfall INTEGER,
  batches JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
  v_remaining INTEGER := p_quantity;
  v_take INTEGER;
  v_batches JSONB := '[]'::jsonb;
  v_batch RECORD;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  SELECT (quantity_in_stock - reserved_quantity) INTO v_available
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;

  IF v_available IS NULL THEN
    RETURN QUERY SELECT false, 0, p_quantity, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_available < p_quantity THEN
    RETURN QUERY SELECT false, 0, (p_quantity - v_available), '[]'::jsonb;
    RETURN;
  END IF;

  FOR v_batch IN
    SELECT id, batch_code, (quantity_in - quantity_sold - quantity_reserved) AS batch_available
    FROM inventory_batches
    WHERE variant_id = p_variant_id
      AND status = 'active'
      AND (quantity_in - quantity_sold - quantity_reserved) > 0
    ORDER BY date_received ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.batch_available);

    UPDATE inventory_batches
      SET quantity_reserved = quantity_reserved + v_take, updated_at = now()
      WHERE id = v_batch.id;

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch.id, 'batch_code', v_batch.batch_code, 'quantity', v_take
    );
    v_remaining := v_remaining - v_take;
  END LOOP;

  UPDATE inventory_variants
    SET reserved_quantity = reserved_quantity + p_quantity, updated_at = now()
    WHERE id = p_variant_id;

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;


CREATE OR REPLACE FUNCTION fn_release_stock_reservation(
  p_variant_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  released_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER := p_quantity;
  v_batch RECORD;
  v_take INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  UPDATE inventory_variants
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity), updated_at = now()
    WHERE id = p_variant_id;

  FOR v_batch IN
    SELECT id, quantity_reserved
    FROM inventory_batches
    WHERE variant_id = p_variant_id AND quantity_reserved > 0
    ORDER BY date_received ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.quantity_reserved);
    UPDATE inventory_batches
      SET quantity_reserved = quantity_reserved - v_take, updated_at = now()
      WHERE id = v_batch.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN QUERY SELECT true, p_quantity;
END;
$$;


CREATE OR REPLACE FUNCTION fn_fulfill_stock_reservation(
  p_variant_id UUID,
  p_quantity INTEGER,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_related_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  fulfilled_quantity INTEGER,
  batches JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_remaining INTEGER := p_quantity;
  v_batch RECORD;
  v_take INTEGER;
  v_new_remaining INTEGER;
  v_stock_before INTEGER;
  v_batches JSONB := '[]'::jsonb;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  SELECT inventory_id INTO v_inventory_id FROM inventory_variants WHERE id = p_variant_id;
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Variant % not found', p_variant_id;
  END IF;

  FOR v_batch IN
    SELECT id, batch_code, cost_price, quantity_reserved, quantity_in, quantity_sold
    FROM inventory_batches
    WHERE variant_id = p_variant_id AND quantity_reserved > 0
    ORDER BY date_received ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.quantity_reserved);
    v_new_remaining := GREATEST(0, v_batch.quantity_in - (v_batch.quantity_sold + v_take));

    UPDATE inventory_batches
      SET quantity_reserved = quantity_reserved - v_take,
          quantity_sold = quantity_sold + v_take,
          quantity_remaining = v_new_remaining,
          status = CASE WHEN v_new_remaining = 0 THEN 'depleted' ELSE status END,
          updated_at = now()
      WHERE id = v_batch.id;

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch.id, 'batch_code', v_batch.batch_code,
      'quantity', v_take, 'cost_price', v_batch.cost_price
    );
    v_remaining := v_remaining - v_take;
  END LOOP;

  SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
  UPDATE inventory_variants
    SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        sold_quantity = sold_quantity + p_quantity,
        updated_at = now()
    WHERE id = p_variant_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
    reason, related_order_id, created_at, updated_at
  ) VALUES (
    p_user_id, v_inventory_id, 'order_processed', v_stock_before, -p_quantity,
    GREATEST(0, COALESCE(v_stock_before, 0) - p_quantity), p_reason, p_related_order_id, now(), now()
  );

  RETURN QUERY SELECT true, p_quantity, v_batches;
END;
$$;


CREATE OR REPLACE FUNCTION fn_sell_stock_direct(
  p_variant_id UUID,
  p_quantity INTEGER,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_related_sale_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  sold_qty INTEGER,
  shortfall INTEGER,
  batches JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_available INTEGER;
  v_remaining INTEGER := p_quantity;
  v_take INTEGER;
  v_batches JSONB := '[]'::jsonb;
  v_batch RECORD;
  v_new_remaining INTEGER;
  v_stock_before INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  SELECT inventory_id, (quantity_in_stock - reserved_quantity) INTO v_inventory_id, v_available
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;

  IF v_available IS NULL THEN
    RETURN QUERY SELECT false, 0, p_quantity, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_available < p_quantity THEN
    RETURN QUERY SELECT false, 0, (p_quantity - v_available), '[]'::jsonb;
    RETURN;
  END IF;

  FOR v_batch IN
    SELECT id, batch_code, cost_price, quantity_in, quantity_sold,
           (quantity_in - quantity_sold - quantity_reserved) AS batch_available
    FROM inventory_batches
    WHERE variant_id = p_variant_id
      AND status = 'active'
      AND (quantity_in - quantity_sold - quantity_reserved) > 0
    ORDER BY date_received ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.batch_available);
    v_new_remaining := GREATEST(0, v_batch.quantity_in - (v_batch.quantity_sold + v_take));

    UPDATE inventory_batches
      SET quantity_sold = quantity_sold + v_take,
          quantity_remaining = v_new_remaining,
          status = CASE WHEN v_new_remaining = 0 THEN 'depleted' ELSE status END,
          updated_at = now()
      WHERE id = v_batch.id;

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch.id, 'batch_code', v_batch.batch_code,
      'quantity', v_take, 'cost_price', v_batch.cost_price
    );
    v_remaining := v_remaining - v_take;
  END LOOP;

  SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = p_variant_id;
  UPDATE inventory_variants
    SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity),
        sold_quantity = sold_quantity + p_quantity,
        updated_at = now()
    WHERE id = p_variant_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
    reason, related_sale_id, created_at, updated_at
  ) VALUES (
    p_user_id, v_inventory_id, 'stock_removed', v_stock_before, -p_quantity,
    GREATEST(0, COALESCE(v_stock_before, 0) - p_quantity), p_reason, p_related_sale_id, now(), now()
  );

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;


-- Bulk wrappers: item shape is now {variant_id, quantity[, reason]} --
-- inventory_id is dropped from the item shape entirely, it was never used
-- for anything the single-item functions needed once variant_id is
-- always present.
CREATE OR REPLACE FUNCTION fn_release_stock_reservations_bulk(
  p_items JSONB
)
RETURNS TABLE (
  idx INTEGER,
  success BOOLEAN,
  released_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_result RECORD;
BEGIN
  FOR v_row IN
    SELECT value AS item, (ordinality - 1)::INTEGER AS item_idx
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(value, ordinality)
  LOOP
    SELECT * INTO v_result FROM fn_release_stock_reservation(
      (v_row.item->>'variant_id')::UUID,
      (v_row.item->>'quantity')::INTEGER
    );
    idx := v_row.item_idx;
    success := v_result.success;
    released_quantity := v_result.released_quantity;
    RETURN NEXT;
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION fn_fulfill_stock_reservations_bulk(
  p_items JSONB,
  p_user_id UUID,
  p_related_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  idx INTEGER,
  success BOOLEAN,
  fulfilled_quantity INTEGER,
  batches JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_result RECORD;
BEGIN
  FOR v_row IN
    SELECT value AS item, (ordinality - 1)::INTEGER AS item_idx
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(value, ordinality)
  LOOP
    SELECT * INTO v_result FROM fn_fulfill_stock_reservation(
      (v_row.item->>'variant_id')::UUID,
      (v_row.item->>'quantity')::INTEGER,
      p_user_id,
      v_row.item->>'reason',
      p_related_order_id
    );
    idx := v_row.item_idx;
    success := v_result.success;
    fulfilled_quantity := v_result.fulfilled_quantity;
    batches := v_result.batches;
    RETURN NEXT;
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION fn_sell_stock_direct_bulk(
  p_items JSONB,
  p_user_id UUID,
  p_related_sale_id UUID DEFAULT NULL
)
RETURNS TABLE (
  idx INTEGER,
  success BOOLEAN,
  sold_qty INTEGER,
  shortfall INTEGER,
  batches JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_result RECORD;
BEGIN
  FOR v_row IN
    SELECT value AS item, (ordinality - 1)::INTEGER AS item_idx
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(value, ordinality)
  LOOP
    SELECT * INTO v_result FROM fn_sell_stock_direct(
      (v_row.item->>'variant_id')::UUID,
      (v_row.item->>'quantity')::INTEGER,
      p_user_id,
      v_row.item->>'reason',
      p_related_sale_id
    );
    IF NOT v_result.success THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK item_idx=% shortfall=%', v_row.item_idx, v_result.shortfall
        USING ERRCODE = 'P0001';
    END IF;
    idx := v_row.item_idx;
    success := v_result.success;
    sold_qty := v_result.sold_qty;
    shortfall := v_result.shortfall;
    batches := v_result.batches;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- Admin-side (Track A) functions, now variant-only too.
CREATE OR REPLACE FUNCTION fn_create_batch(
  p_variant_id UUID,
  p_user_id UUID,
  p_batch_code TEXT,
  p_quantity_in INTEGER,
  p_cost_price NUMERIC,
  p_selling_price NUMERIC,
  p_supplier TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_batch_location TEXT DEFAULT 'Main Store',
  p_date_received TIMESTAMPTZ DEFAULT NOW(),
  p_expiry_date TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (batch_id UUID, batch_code VARCHAR, new_stock_quantity INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_batch_id UUID;
  v_stock_before INTEGER;
  v_new_stock INTEGER;
BEGIN
  IF p_quantity_in IS NULL OR p_quantity_in <= 0 THEN
    RAISE EXCEPTION 'p_quantity_in must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  SELECT inventory_id, quantity_in_stock INTO v_inventory_id, v_stock_before
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Variant % not found', p_variant_id;
  END IF;
  v_new_stock := v_stock_before + p_quantity_in;

  UPDATE inventory_variants
    SET quantity_in_stock = v_new_stock, updated_at = now()
    WHERE id = p_variant_id;

  INSERT INTO inventory_batches (
    inventory_id, variant_id, user_id, batch_code, quantity_in, quantity_sold,
    quantity_remaining, cost_price, selling_price, date_received, expiry_date,
    supplier, notes, status, batch_location
  ) VALUES (
    v_inventory_id, p_variant_id, p_user_id, p_batch_code, p_quantity_in, 0,
    p_quantity_in, p_cost_price, p_selling_price, p_date_received, p_expiry_date,
    p_supplier, p_notes, 'active', p_batch_location
  ) RETURNING id INTO v_batch_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed,
    quantity_after, reason, batch_id, batch_code, created_at, updated_at
  ) VALUES (
    p_user_id, v_inventory_id, 'stock_added', v_stock_before, p_quantity_in,
    v_new_stock, COALESCE(p_reason, 'Batch received: ' || p_batch_code), v_batch_id, p_batch_code, now(), now()
  );

  RETURN QUERY SELECT v_batch_id, p_batch_code::VARCHAR, v_new_stock;
END;
$$;


-- fn_add_to_batch is unchanged in signature (already batch_id-keyed, never
-- took inventory_id/variant_id directly) -- just drops the "IF variant_id
-- IS NOT NULL" branch since a batch's variant_id can no longer be null.
CREATE OR REPLACE FUNCTION fn_add_to_batch(
  p_batch_id UUID,
  p_quantity INTEGER,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (new_batch_remaining INTEGER, new_stock_quantity INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch RECORD;
  v_stock_before INTEGER;
  v_new_stock INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;

  SELECT * INTO v_batch FROM inventory_batches WHERE id = p_batch_id FOR UPDATE;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  IF v_batch.variant_id IS NULL THEN
    RAISE EXCEPTION 'Batch % has no variant_id (likely an archived legacy batch) -- cannot add stock to it', p_batch_id;
  END IF;

  SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = v_batch.variant_id FOR UPDATE;
  v_new_stock := v_stock_before + p_quantity;

  UPDATE inventory_variants
    SET quantity_in_stock = v_new_stock, updated_at = now()
    WHERE id = v_batch.variant_id;

  UPDATE inventory_batches
    SET quantity_in = quantity_in + p_quantity,
        quantity_remaining = quantity_remaining + p_quantity,
        updated_at = now()
    WHERE id = p_batch_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed,
    quantity_after, reason, batch_id, batch_code, created_at, updated_at
  ) VALUES (
    p_user_id, v_batch.inventory_id, 'stock_added', v_stock_before, p_quantity,
    v_new_stock, COALESCE(p_reason, 'Added to batch: ' || v_batch.batch_code), p_batch_id, v_batch.batch_code, now(), now()
  );

  RETURN QUERY SELECT (v_batch.quantity_remaining + p_quantity), v_new_stock;
END;
$$;


CREATE OR REPLACE FUNCTION fn_remove_stock(
  p_variant_id UUID,
  p_batch_id UUID,
  p_quantity INTEGER,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS TABLE (success BOOLEAN, removed_quantity INTEGER, shortfall INTEGER, batches JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_available INTEGER;
  v_remaining INTEGER := p_quantity;
  v_take INTEGER;
  v_batches JSONB := '[]'::jsonb;
  v_batch RECORD;
  v_stock_before INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'p_quantity must be positive';
  END IF;
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'p_variant_id is required';
  END IF;

  SELECT inventory_id, quantity_in_stock INTO v_inventory_id, v_available
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RETURN QUERY SELECT false, 0, GREATEST(0, p_quantity - COALESCE(v_available, 0)), '[]'::jsonb;
    RETURN;
  END IF;

  IF p_batch_id IS NOT NULL THEN
    SELECT * INTO v_batch FROM inventory_batches WHERE id = p_batch_id FOR UPDATE;
    IF v_batch IS NULL OR v_batch.quantity_remaining < p_quantity THEN
      RETURN QUERY SELECT false, 0, GREATEST(0, p_quantity - COALESCE(v_batch.quantity_remaining, 0)), '[]'::jsonb;
      RETURN;
    END IF;

    UPDATE inventory_batches
      SET quantity_remaining = quantity_remaining - p_quantity, updated_at = now()
      WHERE id = p_batch_id;

    v_batches := jsonb_build_array(jsonb_build_object('batch_id', v_batch.id, 'batch_code', v_batch.batch_code, 'quantity', p_quantity));
    v_remaining := 0;
  ELSE
    FOR v_batch IN
      SELECT id, batch_code, quantity_remaining
      FROM inventory_batches
      WHERE variant_id = p_variant_id AND status = 'active' AND quantity_remaining > 0
      ORDER BY date_received ASC NULLS LAST, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_batch.quantity_remaining);

      UPDATE inventory_batches
        SET quantity_remaining = quantity_remaining - v_take, updated_at = now()
        WHERE id = v_batch.id;

      v_batches := v_batches || jsonb_build_object('batch_id', v_batch.id, 'batch_code', v_batch.batch_code, 'quantity', v_take);
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock in active batches to remove % units (% short)', p_quantity, v_remaining;
    END IF;
  END IF;

  v_stock_before := v_available;
  UPDATE inventory_variants
    SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity), updated_at = now()
    WHERE id = p_variant_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed,
    quantity_after, reason, metadata, created_at, updated_at
  ) VALUES (
    p_user_id, v_inventory_id, 'stock_removed', v_stock_before, -p_quantity,
    GREATEST(0, v_stock_before - p_quantity), p_reason,
    jsonb_build_object('batches', v_batches), now(), now()
  );

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;


-- Stats aggregate: totals/low-stock/out-of-stock now roll up from
-- inventory_variants per product instead of reading inventory.stock_quantity/
-- base_price/cost directly (those columns are retired). A product's
-- "stock" for these purposes is the sum of its variants' quantity_in_stock;
-- "value" uses each variant's own cost/price, falling back to the product's
-- listing-level values only if a variant somehow has neither (shouldn't
-- happen post-migration, kept only as a defensive fallback).
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
    COALESCE(SUM(v.quantity_in_stock * COALESCE(v.cost_price, i.cost, 0)), 0) AS stock_value,
    COALESCE(SUM(v.quantity_in_stock * COALESCE(v.price, i.base_price, 0)), 0) AS selling_value
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
