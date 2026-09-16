-- Runs inventory item edits (inventory row + variant updates) in one
-- Postgres transaction so the API cannot persist partial success.
-- Any exception inside this function rolls back all statements from this
-- call automatically.
CREATE OR REPLACE FUNCTION fn_update_inventory_item_atomic(
  p_inventory_id UUID,
  p_user_id UUID,
  p_inventory_patch JSONB,
  p_apply_price_update BOOLEAN DEFAULT false,
  p_price NUMERIC DEFAULT NULL,
  p_cost_price NUMERIC DEFAULT NULL,
  p_variants JSONB DEFAULT NULL,
  p_apply_passive_update BOOLEAN DEFAULT false,
  p_passive_reorder_level INTEGER DEFAULT NULL,
  p_touches_made_to_order BOOLEAN DEFAULT false,
  p_is_made_to_order BOOLEAN DEFAULT false,
  p_max_orders_per_day INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory_id UUID;
  v_variant JSONB;
  v_variant_id UUID;
  v_variant_reorder_level INTEGER;
  v_keep_variant_ids UUID[] := ARRAY[]::UUID[];
  v_new_variant_id UUID;
  v_default_price NUMERIC := 0;
  v_default_cost NUMERIC := 0;
  v_existing_unlimited BOOLEAN := false;
  v_existing_max_orders INTEGER := NULL;
  v_effective_is_unlimited BOOLEAN;
  v_effective_max_orders INTEGER;
BEGIN
  IF p_inventory_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Inventory id and user id are required';
  END IF;

  UPDATE inventory i
  SET
    name = CASE WHEN p_inventory_patch ? 'name' THEN (p_inventory_patch->>'name') ELSE i.name END,
    description = CASE WHEN p_inventory_patch ? 'description' THEN (p_inventory_patch->>'description') ELSE i.description END,
    category = CASE WHEN p_inventory_patch ? 'category' THEN (p_inventory_patch->>'category') ELSE i.category END,
    category_details = CASE WHEN p_inventory_patch ? 'category_details' THEN COALESCE(p_inventory_patch->'category_details', '{}'::jsonb) ELSE i.category_details END,
    sku = CASE WHEN p_inventory_patch ? 'sku' THEN NULLIF(p_inventory_patch->>'sku', '') ELSE i.sku END,
    barcode = CASE WHEN p_inventory_patch ? 'barcode' THEN NULLIF(p_inventory_patch->>'barcode', '') ELSE i.barcode END,
    minimum_stock = CASE WHEN p_inventory_patch ? 'minimum_stock' THEN COALESCE((p_inventory_patch->>'minimum_stock')::INTEGER, 0) ELSE i.minimum_stock END,
    images = CASE WHEN p_inventory_patch ? 'images' THEN COALESCE(p_inventory_patch->'images', '[]'::jsonb) ELSE i.images END,
    tags = CASE WHEN p_inventory_patch ? 'tags' THEN COALESCE(p_inventory_patch->'tags', '[]'::jsonb) ELSE i.tags END,
    is_active = CASE WHEN p_inventory_patch ? 'is_active' THEN COALESCE((p_inventory_patch->>'is_active')::BOOLEAN, i.is_active) ELSE i.is_active END,
    updated_at = NOW()
  WHERE i.id = p_inventory_id AND i.user_id = p_user_id
  RETURNING i.id INTO v_inventory_id;

  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventory item % not found for this user', p_inventory_id;
  END IF;

  SELECT
    COALESCE(p_price, v.price, 0),
    COALESCE(p_cost_price, v.cost_price, 0),
    COALESCE(v.is_unlimited, false),
    v.max_orders_per_day
  INTO
    v_default_price,
    v_default_cost,
    v_existing_unlimited,
    v_existing_max_orders
  FROM inventory_variants v
  WHERE v.inventory_id = p_inventory_id
  ORDER BY v.created_at ASC
  LIMIT 1;

  v_effective_is_unlimited := CASE
    WHEN p_touches_made_to_order THEN p_is_made_to_order
    ELSE COALESCE(v_existing_unlimited, false)
  END;
  v_effective_max_orders := CASE
    WHEN p_touches_made_to_order THEN p_max_orders_per_day
    ELSE v_existing_max_orders
  END;

  IF p_apply_price_update THEN
    UPDATE inventory_variants
    SET
      price = COALESCE(p_price, price),
      cost_price = COALESCE(p_cost_price, cost_price),
      updated_at = NOW()
    WHERE inventory_id = p_inventory_id;
  END IF;

  IF p_variants IS NOT NULL AND jsonb_typeof(p_variants) = 'array' AND jsonb_array_length(p_variants) > 0 THEN
    FOR v_variant IN SELECT value FROM jsonb_array_elements(p_variants)
    LOOP
      v_variant_id := NULL;
      IF COALESCE(v_variant->>'id', v_variant->>'_id', '') <> '' THEN
        v_variant_id := COALESCE(v_variant->>'id', v_variant->>'_id')::UUID;
      END IF;

      v_variant_reorder_level := COALESCE(
        NULLIF(v_variant->>'reorderLevel', '')::INTEGER,
        p_passive_reorder_level,
        5
      );

      IF v_variant_id IS NOT NULL THEN
        UPDATE inventory_variants
        SET
          size = COALESCE(NULLIF(v_variant->>'size', ''), 'One Size'),
          color = COALESCE(NULLIF(v_variant->>'color', ''), 'Default'),
          sku = NULLIF(v_variant->>'sku', ''),
          reorder_level = v_variant_reorder_level,
          images = COALESCE(v_variant->'images', '[]'::jsonb),
          is_active = true,
          is_unlimited = CASE WHEN p_touches_made_to_order THEN p_is_made_to_order ELSE is_unlimited END,
          max_orders_per_day = CASE WHEN p_touches_made_to_order THEN p_max_orders_per_day ELSE max_orders_per_day END,
          updated_at = NOW()
        WHERE id = v_variant_id AND inventory_id = p_inventory_id;

        IF FOUND THEN
          v_keep_variant_ids := array_append(v_keep_variant_ids, v_variant_id);
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO inventory_variants (
        inventory_id,
        size,
        color,
        sku,
        quantity_in_stock,
        reorder_level,
        price,
        cost_price,
        images,
        is_active,
        is_unlimited,
        max_orders_per_day
      ) VALUES (
        p_inventory_id,
        COALESCE(NULLIF(v_variant->>'size', ''), 'One Size'),
        COALESCE(NULLIF(v_variant->>'color', ''), 'Default'),
        NULLIF(v_variant->>'sku', ''),
        0,
        v_variant_reorder_level,
        COALESCE(p_price, v_default_price, 0),
        COALESCE(p_cost_price, v_default_cost, 0),
        COALESCE(v_variant->'images', '[]'::jsonb),
        true,
        v_effective_is_unlimited,
        v_effective_max_orders
      )
      RETURNING id INTO v_new_variant_id;

      v_keep_variant_ids := array_append(v_keep_variant_ids, v_new_variant_id);
    END LOOP;

    UPDATE inventory_variants
    SET is_active = false, updated_at = NOW()
    WHERE inventory_id = p_inventory_id
      AND is_active = true
      AND NOT (id = ANY(v_keep_variant_ids));
  ELSIF p_apply_passive_update THEN
    UPDATE inventory_variants
    SET
      reorder_level = COALESCE(p_passive_reorder_level, reorder_level),
      is_unlimited = CASE WHEN p_touches_made_to_order THEN p_is_made_to_order ELSE is_unlimited END,
      max_orders_per_day = CASE WHEN p_touches_made_to_order THEN p_max_orders_per_day ELSE max_orders_per_day END,
      updated_at = NOW()
    WHERE inventory_id = p_inventory_id
      AND is_active = true;
  END IF;

  RETURN v_inventory_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
