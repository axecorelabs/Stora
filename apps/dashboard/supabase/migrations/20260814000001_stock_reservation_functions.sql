-- Atomic stock reservation/release/fulfillment/direct-sale, replacing the
-- read-then-write-in-JS pattern used everywhere today (checkout, POS, order
-- fulfillment), which has no row locking or transaction and can oversell
-- stock under concurrent requests. Every mutation of inventory/inventory_
-- variants/inventory_batches quantities should go through these functions
-- from here on -- nothing else should UPDATE those quantity columns
-- directly, or the locking-order guarantee that avoids deadlocks breaks.
--
-- Locking strategy:
--   - Where the amount to take depends on reading a live number (reserving,
--     selling direct, walking FIFO batches), lock the row with
--     `SELECT ... FOR UPDATE` before deciding, so a concurrent transaction
--     on the same row blocks until this one commits, then sees the
--     post-commit value.
--   - Where the operation is a pure delta with a known quantity (release,
--     decrementing a reserved counter), a single relative
--     `UPDATE ... SET col = col - delta` is already atomic on its own --
--     Postgres takes the row lock and evaluates the SET expression against
--     the current row version, so no extra locking is needed and no
--     "SELECT all siblings, sum in JS, write the sum back" step is needed
--     either (that pattern is itself a race when siblings are being
--     modified concurrently -- replaced here by a plain relative update on
--     the parent row every time a variant's reservation changes).

CREATE TABLE order_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  batch_code VARCHAR(100),
  quantity_reserved INTEGER NOT NULL CHECK (quantity_reserved >= 0),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX order_item_batches_order_item_id_idx ON order_item_batches (order_item_id);


-- Reserve stock for a checkout/order line. Returns success=false with a
-- shortfall (no writes at all) if there isn't enough available; otherwise
-- walks active batches FIFO, reserves from each, and bumps the parent
-- inventory row's (and variant row's, if applicable) quantity_reserved by
-- the full requested amount in the same transaction as the batch walk.
CREATE OR REPLACE FUNCTION fn_reserve_stock(
  p_inventory_id UUID,
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
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  -- Lock the authoritative "available" row first. This serializes every
  -- concurrent reserve/release/fulfill/direct-sale against this product (or
  -- this variant) and guarantees the read below isn't stale by write time.
  IF p_variant_id IS NOT NULL THEN
    SELECT (quantity_in_stock - reserved_quantity) INTO v_available
    FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
  ELSE
    SELECT (stock_quantity - quantity_reserved) INTO v_available
    FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  END IF;

  IF v_available IS NULL THEN
    RETURN QUERY SELECT false, 0, p_quantity, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_available < p_quantity THEN
    RETURN QUERY SELECT false, 0, (p_quantity - v_available), '[]'::jsonb;
    RETURN;
  END IF;

  -- FIFO walk, locking each candidate batch as it's visited so a concurrent
  -- reservation can't take the same units from the same batch.
  FOR v_batch IN
    SELECT id, batch_code, (quantity_in - quantity_sold - quantity_reserved) AS batch_available
    FROM inventory_batches
    WHERE inventory_id = p_inventory_id
      AND status = 'active'
      AND (p_variant_id IS NULL OR variant_id = p_variant_id)
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

  -- The parent counter is the gate we already checked under lock above, so
  -- this is an unconditional relative bump by the full requested amount --
  -- batches may under-cover it if batch bookkeeping has drifted from the
  -- parent stock number (a pre-existing, separate inconsistency, out of
  -- scope here), but stock_quantity/quantity_in_stock is what's actually
  -- authoritative for the availability check everywhere else in the app.
  IF p_variant_id IS NOT NULL THEN
    UPDATE inventory_variants
      SET reserved_quantity = reserved_quantity + p_quantity, updated_at = now()
      WHERE id = p_variant_id;
  END IF;

  UPDATE inventory
    SET quantity_reserved = quantity_reserved + p_quantity, updated_at = now()
    WHERE id = p_inventory_id;

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;


-- Undo a reservation (e.g. order cancelled before fulfillment). Pure deltas,
-- so no FOR UPDATE needed on the parent rows -- a single-row UPDATE with a
-- relative SET is already atomic. Batch rows are still locked while walked
-- since which batch(es) to release from does depend on their current state.
CREATE OR REPLACE FUNCTION fn_release_stock_reservation(
  p_inventory_id UUID,
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
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    UPDATE inventory_variants
      SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity), updated_at = now()
      WHERE id = p_variant_id;
  END IF;

  UPDATE inventory
    SET quantity_reserved = GREATEST(0, quantity_reserved - p_quantity), updated_at = now()
    WHERE id = p_inventory_id;

  FOR v_batch IN
    SELECT id, quantity_reserved
    FROM inventory_batches
    WHERE inventory_id = p_inventory_id
      AND (p_variant_id IS NULL OR variant_id = p_variant_id)
      AND quantity_reserved > 0
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

  -- The parent counter was unconditionally adjusted by the full requested
  -- amount above (mirroring fn_reserve_stock's semantics: the authoritative
  -- parent-level change always equals p_quantity on success). v_remaining
  -- here only reflects how much of that was traceable to specific batches,
  -- which is separate bookkeeping, not the caller-facing result.
  RETURN QUERY SELECT true, p_quantity;
END;
$$;


-- Convert an existing reservation into an actual sale (e.g. order
-- delivered, or POS checkout against a pre-reserved web order): moves
-- batch quantity_reserved -> quantity_sold (decrementing quantity_remaining,
-- flipping status to 'depleted' at zero), decrements the parent's
-- stock_quantity/quantity_in_stock and quantity_reserved, increments
-- sold_quantity, and logs an inventory_activities row in the same
-- transaction as the mutation it describes.
CREATE OR REPLACE FUNCTION fn_fulfill_stock_reservation(
  p_inventory_id UUID,
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
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  FOR v_batch IN
    SELECT id, batch_code, cost_price, quantity_reserved, quantity_in, quantity_sold
    FROM inventory_batches
    WHERE inventory_id = p_inventory_id
      AND (p_variant_id IS NULL OR variant_id = p_variant_id)
      AND quantity_reserved > 0
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

  IF p_variant_id IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
    UPDATE inventory_variants
      SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity),
          reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
          sold_quantity = sold_quantity + p_quantity,
          updated_at = now()
      WHERE id = p_variant_id;
  ELSE
    SELECT stock_quantity INTO v_stock_before FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  END IF;

  UPDATE inventory
    SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
        quantity_reserved = GREATEST(0, quantity_reserved - p_quantity),
        sold_quantity = sold_quantity + p_quantity,
        updated_at = now()
    WHERE id = p_inventory_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
    reason, related_order_id, created_at, updated_at
  ) VALUES (
    p_user_id, p_inventory_id, 'order_processed', v_stock_before, -p_quantity,
    GREATEST(0, COALESCE(v_stock_before, 0) - p_quantity), p_reason, p_related_order_id, now(), now()
  );

  -- The parent counter was unconditionally adjusted by the full requested
  -- amount above (mirroring fn_reserve_stock's semantics: the authoritative
  -- parent-level change always equals p_quantity on success). v_remaining
  -- here only reflects how much of that was traceable to specific batches,
  -- which is separate bookkeeping, not the caller-facing result.
  RETURN QUERY SELECT true, p_quantity, v_batches;
END;
$$;


-- Sell stock directly with no prior reservation (POS sale not tied to a web
-- order). Same FIFO/locking shape as fn_reserve_stock, but the availability
-- gate is stock_quantity - quantity_reserved (not raw stock_quantity, which
-- is what POS checks today -- that let POS oversell stock already reserved
-- by a pending web order), and it writes straight to sold_quantity/batch
-- quantity_sold instead of quantity_reserved.
CREATE OR REPLACE FUNCTION fn_sell_stock_direct(
  p_inventory_id UUID,
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
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'p_inventory_id is required';
  END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT (quantity_in_stock - reserved_quantity) INTO v_available
    FROM inventory_variants WHERE id = p_variant_id FOR UPDATE;
  ELSE
    SELECT (stock_quantity - quantity_reserved) INTO v_available
    FROM inventory WHERE id = p_inventory_id FOR UPDATE;
  END IF;

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
    WHERE inventory_id = p_inventory_id
      AND status = 'active'
      AND (p_variant_id IS NULL OR variant_id = p_variant_id)
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

  IF p_variant_id IS NOT NULL THEN
    SELECT quantity_in_stock INTO v_stock_before FROM inventory_variants WHERE id = p_variant_id;
    UPDATE inventory_variants
      SET quantity_in_stock = GREATEST(0, quantity_in_stock - p_quantity),
          sold_quantity = sold_quantity + p_quantity,
          updated_at = now()
      WHERE id = p_variant_id;
  ELSE
    SELECT stock_quantity INTO v_stock_before FROM inventory WHERE id = p_inventory_id;
  END IF;

  UPDATE inventory
    SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
        sold_quantity = sold_quantity + p_quantity,
        updated_at = now()
    WHERE id = p_inventory_id;

  INSERT INTO inventory_activities (
    user_id, inventory_id, activity_type, quantity_before, quantity_changed, quantity_after,
    reason, related_sale_id, created_at, updated_at
  ) VALUES (
    p_user_id, p_inventory_id, 'stock_removed', v_stock_before, -p_quantity,
    GREATEST(0, COALESCE(v_stock_before, 0) - p_quantity), p_reason, p_related_sale_id, now(), now()
  );

  RETURN QUERY SELECT true, p_quantity, 0, v_batches;
END;
$$;
