-- fn_sell_stock_direct (the RPC every walk-in POS sale goes through, via
-- processItemsWithBatchTracking's isOrderProcessing=false path) was never
-- updated when made-to-order support landed in
-- 20260915000000_made_to_order_menu_items.sql -- that migration only
-- touched fn_reserve_stock and fn_fulfill_stock_reservation (the
-- checkout/online-order path). A made-to-order variant always has
-- quantity_in_stock=0 (no batch is ever created for one -- see
-- apps/dashboard/src/app/api/inventory/route.js's isMadeToOrder branch),
-- so this function's own availability gate (v_available := 0 - 0 = 0)
-- rejected every walk-in sale of one as "out of stock". Compounded by
-- apps/dashboard/src/hooks/usePOSData.js filtering the POS product grid to
-- quantityInStock > 0, which hid the item from the list before a vendor
-- could even try. Both need fixing together -- the JS-side filter fix and
-- the transformInventory field this RPC fix depends on ship in the same
-- commit as this migration.
--
-- Mirrors fn_reserve_stock's unlimited branch (skip stock/batches
-- entirely, gate on a daily cap instead), with one real difference: a POS
-- sale is immediate, not a reservation, so there's no separate
-- fulfillment step later to also update -- this function alone both
-- checks the cap and records the sale. The daily cap is enforced across
-- BOTH channels combined (today's online orders AND today's walk-in POS
-- sales of the same item) -- a kitchen's made-to-order capacity is one
-- shared number regardless of how the order came in, not a separate
-- allowance per channel. sale_items has no variant_id column (only
-- inventory_id -- see 20260717000000_initial_schema.sql), so the POS side
-- of the count is joined on inventory_id rather than variant_id; a
-- practical approximation, not a precision loss in practice, since a
-- made-to-order menu item realistically has exactly one variant.
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
  v_is_unlimited BOOLEAN;
  v_max_per_day INTEGER;
  v_today_start TIMESTAMPTZ;
  v_sold_today INTEGER;
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

  SELECT inventory_id, is_unlimited, max_orders_per_day, (quantity_in_stock - reserved_quantity)
    INTO v_inventory_id, v_is_unlimited, v_max_per_day, v_available
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    RETURN QUERY SELECT false, 0, p_quantity, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_is_unlimited THEN
    v_today_start := (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos')) AT TIME ZONE 'Africa/Lagos';

    SELECT
      COALESCE((
        SELECT SUM(oi.quantity) FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.variant_id = p_variant_id
          AND o.status != 'cancelled'
          AND o.created_at >= v_today_start
          AND o.created_at < v_today_start + interval '1 day'
      ), 0)
      +
      COALESCE((
        SELECT SUM(si.quantity) FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE si.inventory_id = v_inventory_id
          AND s.status != 'cancelled'
          AND s.sale_date >= v_today_start
          AND s.sale_date < v_today_start + interval '1 day'
      ), 0)
    INTO v_sold_today;

    IF v_sold_today + p_quantity > v_max_per_day THEN
      RETURN QUERY SELECT false, 0, GREATEST(0, v_max_per_day - v_sold_today), '[]'::jsonb;
      RETURN;
    END IF;

    UPDATE inventory_variants
      SET sold_quantity = sold_quantity + p_quantity, updated_at = now()
      WHERE id = p_variant_id;

    INSERT INTO inventory_activities (
      user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
      reason, related_sale_id, created_at, updated_at
    ) VALUES (
      p_user_id, v_inventory_id, 'stock_removed', NULL, -p_quantity, NULL,
      COALESCE(p_reason, 'Made-to-order item sold'), p_related_sale_id, now(), now()
    );

    RETURN QUERY SELECT true, p_quantity, 0, '[]'::jsonb;
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

NOTIFY pgrst, 'reload schema';
