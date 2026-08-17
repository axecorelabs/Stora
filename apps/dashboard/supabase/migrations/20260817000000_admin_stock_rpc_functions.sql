-- Closes Track A of the inventory schema audit: every dashboard route that
-- creates a product, adds a batch, or manually adjusts stock currently
-- writes inventory/inventory_batches/inventory_variants directly -- plain
-- .update()/.insert() calls, no row locking, no transaction. That's the
-- exact "read-then-write-in-JS" pattern
-- 20260814000001_stock_reservation_functions.sql already replaced on the
-- selling side (checkout/POS/fulfillment). It was never replaced on the
-- admin side. These three functions close that gap using the same locking
-- discipline (FOR UPDATE on the parent row, then walk/lock affected
-- batches) as the existing fn_reserve_stock/fn_sell_stock_direct.
--
-- All three accept an optional p_variant_id -- not yet wired up by any
-- caller (the admin batch/stock routes today only ever operate at the
-- product level, even for has_variants products), but present so the
-- frontend can start passing one without another migration.

-- Create a brand-new batch and atomically bump the parent's stock_quantity
-- (and the variant's quantity_in_stock, if variant-scoped) by quantity_in.
-- Used for: a product's initial batch at creation, and "add batch" from
-- the batches UI.
CREATE OR REPLACE FUNCTION fn_create_batch(
  p_inventory_id UUID,
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
  v_batch_id UUID;
  v_stock_before INTEGER;
  v_new_stock INTEGER;
BEGIN
  IF p_quantity_in IS NULL OR p_quantity_in <= 0 THEN
    RAISE EXCEPTION 'p_quantity_in must be positive';
  END IF;
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  -- Lock the parent row first, same ordering as fn_reserve_stock, so a
  -- concurrent receive/adjust on this product serializes cleanly.
  IF p_variant_id IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
    UPDATE inventory_variants
      SET quantity_in_stock = quantity_in_stock + p_quantity_in, updated_at = now()
      WHERE id = p_variant_id;
  END IF;

  SELECT stock_quantity INTO v_stock_before FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  IF v_stock_before IS NULL THEN
    RAISE EXCEPTION 'Inventory item % not found', p_inventory_id;
  END IF;
  v_new_stock := v_stock_before + p_quantity_in;

  UPDATE inventory
    SET stock_quantity = v_new_stock, updated_at = now()
    WHERE id = p_inventory_id;

  INSERT INTO inventory_batches (
    inventory_id, variant_id, user_id, batch_code, quantity_in, quantity_sold,
    quantity_remaining, cost_price, selling_price, date_received, expiry_date,
    supplier, notes, status, batch_location
  ) VALUES (
    p_inventory_id, p_variant_id, p_user_id, p_batch_code, p_quantity_in, 0,
    p_quantity_in, p_cost_price, p_selling_price, p_date_received, p_expiry_date,
    p_supplier, p_notes, 'active', p_batch_location
  ) RETURNING id INTO v_batch_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed,
    quantity_after, reason, batch_id, batch_code, created_at, updated_at
  ) VALUES (
    p_user_id, p_inventory_id, 'stock_added', v_stock_before, p_quantity_in,
    v_new_stock, COALESCE(p_reason, 'Batch received: ' || p_batch_code), v_batch_id, p_batch_code, now(), now()
  );

  RETURN QUERY SELECT v_batch_id, p_batch_code::VARCHAR, v_new_stock;
END;
$$;


-- Add quantity to an EXISTING batch (restocking the same batch code) and
-- atomically bump the parent's stock_quantity/variant quantity_in_stock to
-- match. Used by the stock-adjustment UI's "add to existing batch" path.
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

  IF v_batch.variant_id IS NOT NULL THEN
    UPDATE inventory_variants
      SET quantity_in_stock = quantity_in_stock + p_quantity, updated_at = now()
      WHERE id = v_batch.variant_id;
  END IF;

  SELECT stock_quantity INTO v_stock_before FROM inventory WHERE id = v_batch.inventory_id FOR UPDATE;
  v_new_stock := v_stock_before + p_quantity;

  UPDATE inventory
    SET stock_quantity = v_new_stock, updated_at = now()
    WHERE id = v_batch.inventory_id;

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


-- Manual stock removal -- a correction/write-off (damage, loss, recount),
-- NOT a sale. Deliberately does not touch quantity_sold on either the
-- batch or the parent: the pre-existing hand-written version of this
-- route booked manual removals into quantity_sold, the same counter real
-- sales use, silently inflating sold-quantity/profit metrics with stock
-- that was never actually sold. Removes from a specific batch if
-- p_batch_id is given, otherwise walks active batches FIFO (oldest
-- date_received first), same ordering as fn_sell_stock_direct.
CREATE OR REPLACE FUNCTION fn_remove_stock(
  p_inventory_id UUID,
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
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_available FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
  ELSE
    SELECT stock_quantity INTO v_available FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  END IF;

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
      WHERE inventory_id = p_inventory_id
        AND status = 'active'
        AND (p_variant_id IS NULL OR variant_id = p_variant_id)
        AND quantity_remaining > 0
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

  IF p_variant_id IS NOT NULL THEN
    UPDATE inventory_variants
      SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity), updated_at = now()
      WHERE id = p_variant_id;
  END IF;

  SELECT stock_quantity INTO v_stock_before FROM inventory WHERE id = p_inventory_id;
  UPDATE inventory
    SET stock_quantity = GREATEST(0, stock_quantity - p_quantity), updated_at = now()
    WHERE id = p_inventory_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed,
    quantity_after, reason, metadata, created_at, updated_at
  ) VALUES (
    p_user_id, p_inventory_id, 'stock_removed', v_stock_before, -p_quantity,
    GREATEST(0, v_stock_before - p_quantity), p_reason,
    jsonb_build_object('batches', v_batches), now(), now()
  );

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;
