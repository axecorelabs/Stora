-- Bulk variants of fn_release_stock_reservation / fn_fulfill_stock_reservation /
-- fn_sell_stock_direct (20260814000001_stock_reservation_functions.sql).
--
-- Every call site that processes an order's or a sale's line items was
-- doing so in a JS loop -- one network round trip to Postgres per item
-- (order cancellation, order-delivered fulfillment, POS checkout). On a
-- rush-hour multi-item order that's N sequential round trips blocking the
-- response. These wrap the existing, already-tested single-item functions
-- in a server-side loop so the whole batch is one round trip and one
-- Postgres transaction -- the single-item FIFO/locking logic itself is
-- untouched and reused as-is, not reimplemented.
--
-- Item shape in p_items (JSONB array): {inventory_id, variant_id, quantity}
-- for release; adds "reason" (per-item, since fulfillment reason strings
-- embed each item's product name/quantity) for fulfill/sell-direct.
-- variant_id absent, JSON null, or "" all resolve to SQL NULL (no variant).

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
      (v_row.item->>'inventory_id')::UUID,
      NULLIF(v_row.item->>'variant_id', '')::UUID,
      (v_row.item->>'quantity')::INTEGER
    );
    idx := v_row.item_idx;
    success := v_result.success;
    released_quantity := v_result.released_quantity;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- fn_fulfill_stock_reservation never fails (no availability gate -- it
-- fulfills whatever was actually reserved), so no rollback/exception path
-- is needed here, matching the single-item function's own semantics.
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
      (v_row.item->>'inventory_id')::UUID,
      NULLIF(v_row.item->>'variant_id', '')::UUID,
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


-- Unlike fulfill/release, fn_sell_stock_direct DOES have an availability
-- gate and can genuinely fail (insufficient stock). On any item's failure,
-- this raises so the whole call rolls back atomically -- a deliberate
-- correctness improvement over the old per-item JS loop, which committed
-- each RPC call independently and could leave a POS sale half-processed
-- (earlier items already sold) if a later item ran out of stock. The
-- message carries item_idx/shortfall so the caller can map back to which
-- line item and build a specific error for the user.
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
      (v_row.item->>'inventory_id')::UUID,
      NULLIF(v_row.item->>'variant_id', '')::UUID,
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
