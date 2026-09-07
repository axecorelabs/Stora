-- "Made to order" support for Food-category menu items: a variant can be
-- flagged unlimited-stock, gated only by a real, enforced max-orders-per-day
-- cap instead of a fake quantityInStock number a vendor had to make up for a
-- dish that's actually cooked to order. Previously maxOrdersPerDay existed
-- only as a display field on the storefront's product page (see
-- ProductDetailsClient.js) -- nothing ever enforced it.
--
-- Lives on inventory_variants, not inventory -- every product (Food
-- included) already has exactly one real variant row per
-- 20260817000001_unify_inventory_variants.sql, and stock/availability is
-- already resolved per-variant everywhere (fn_reserve_stock, resolveBatchPricing
-- in apps/store/src/lib/supabaseStore.js), so this fits the existing model
-- with no new join needed at the enforcement point.
ALTER TABLE inventory_variants ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inventory_variants ADD COLUMN IF NOT EXISTS max_orders_per_day INTEGER;

ALTER TABLE inventory_variants DROP CONSTRAINT IF EXISTS inventory_variants_unlimited_requires_cap;
ALTER TABLE inventory_variants ADD CONSTRAINT inventory_variants_unlimited_requires_cap
  CHECK (NOT is_unlimited OR (max_orders_per_day IS NOT NULL AND max_orders_per_day > 0));

-- Reserve stock for a checkout/order line -- same shape as
-- 20260817000002_variant_only_rpcs.sql, with one new branch at the top: an
-- unlimited variant skips the quantity_in_stock/batches gate entirely (there
-- is no real stock to check or reserve) and is instead gated by how many
-- units of it have already been ordered today. "Today" is a fixed
-- Africa/Lagos (WAT, UTC+1, no DST) boundary, not a per-store timezone --
-- every Nigerian state is the same timezone, so there's nothing to look up
-- per vendor. Computed on the fly against order_items/orders rather than a
-- maintained counter, so there's no daily-reset cron to build or forget to
-- run; cancelled orders are excluded so a cancelled/abandoned order (see
-- apps/store/src/app/api/payments/cleanup-abandoned) doesn't permanently
-- eat into the day's capacity.
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
  v_is_unlimited BOOLEAN;
  v_max_per_day INTEGER;
  v_today_start TIMESTAMPTZ;
  v_ordered_today INTEGER;
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

  SELECT is_unlimited, max_orders_per_day INTO v_is_unlimited, v_max_per_day
  FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;

  IF v_is_unlimited IS NULL THEN
    RETURN QUERY SELECT false, 0, p_quantity, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_is_unlimited THEN
    v_today_start := (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos')) AT TIME ZONE 'Africa/Lagos';

    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_ordered_today
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.variant_id = p_variant_id
      AND o.status != 'cancelled'
      AND o.created_at >= v_today_start
      AND o.created_at < v_today_start + interval '1 day';

    IF v_ordered_today + p_quantity > v_max_per_day THEN
      RETURN QUERY SELECT false, 0, GREATEST(0, v_max_per_day - v_ordered_today), '[]'::jsonb;
      RETURN;
    END IF;

    -- No quantity_in_stock/reserved_quantity/batches to touch -- there's no
    -- real stock behind a made-to-order item, only the daily count checked
    -- above (recomputed fresh on every call, nothing to release either).
    RETURN QUERY SELECT true, p_quantity, 0, '[]'::jsonb;
    RETURN;
  END IF;

  SELECT (quantity_in_stock - reserved_quantity) INTO v_available
  FROM inventory_variants WHERE id = p_variant_id;

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

-- Fulfills a reservation into a real sale at delivery time (see
-- updateOrderStatus in apps/store/src/lib/supabaseOrders.js). An unlimited
-- variant never had quantity_in_stock/reserved_quantity touched at
-- reservation time, so there's nothing to decrement here either -- just
-- credit sold_quantity (still meaningful as a running total-sold counter)
-- and skip the batch walk (a made-to-order item has none).
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
  v_is_unlimited BOOLEAN;
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

  SELECT inventory_id, is_unlimited INTO v_inventory_id, v_is_unlimited
  FROM inventory_variants WHERE id = p_variant_id;
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Variant % not found', p_variant_id;
  END IF;

  IF v_is_unlimited THEN
    UPDATE inventory_variants
      SET sold_quantity = sold_quantity + p_quantity, updated_at = now()
      WHERE id = p_variant_id;

    INSERT INTO inventory_activities (
      user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
      reason, related_order_id, created_at, updated_at
    ) VALUES (
      p_user_id, v_inventory_id, 'order_processed', NULL, -p_quantity, NULL,
      COALESCE(p_reason, 'Made-to-order item fulfilled'), p_related_order_id, now(), now()
    );

    RETURN QUERY SELECT true, p_quantity, '[]'::jsonb;
    RETURN;
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

NOTIFY pgrst, 'reload schema';
