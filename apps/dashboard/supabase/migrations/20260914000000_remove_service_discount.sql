-- Removes the "discount" concept from services entirely -- unlike the
-- product/e-commerce side, a service booking is contact-only (no cart, no
-- checkout), so nothing on the platform ever applied or enforced a
-- discount a vendor typed in. Showing "15% off" to a shopper who then
-- messages the vendor was a promise Stora had no way to back up.
--
-- CREATE OR REPLACE matches on the exact parameter list -- removing a
-- parameter doesn't replace the old function, it fails outright (return
-- type/argument mismatch) or, worse, silently leaves a second overload
-- around (the exact ambiguity documented in
-- 20260823000002_drop_ambiguous_search_overloads.sql). Drop the old
-- 18-arg signature explicitly first so only the new 17-arg one remains.
DROP FUNCTION IF EXISTS fn_write_service_item(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, TEXT, INTEGER,
  BOOLEAN, NUMERIC, INTEGER, INTEGER, JSONB, JSONB, JSONB, JSONB
);

CREATE FUNCTION fn_write_service_item(
  p_item_id UUID,
  p_service_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_category TEXT,
  p_sub_category TEXT,
  p_price NUMERIC,
  p_duration INTEGER,
  p_duration_unit TEXT,
  p_years_of_experience INTEGER,
  p_home_service_available BOOLEAN,
  p_time_slot_duration INTEGER,
  p_max_bookings_per_day INTEGER,
  p_portfolio_images JSONB,
  p_availability JSONB,
  p_locations JSONB,
  p_add_ons JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Price must be a non-negative number';
  END IF;
  IF p_duration IS NOT NULL AND p_duration <= 0 THEN
    RAISE EXCEPTION 'Duration must be greater than 0';
  END IF;
  IF p_max_bookings_per_day IS NULL OR p_max_bookings_per_day <= 0 THEN
    RAISE EXCEPTION 'Max bookings per day must be greater than 0';
  END IF;

  IF p_item_id IS NOT NULL THEN
    v_item_id := p_item_id;
    UPDATE service_items SET
      name = p_name,
      description = p_description,
      category = p_category,
      sub_category = p_sub_category,
      price = p_price,
      duration = p_duration,
      duration_unit = COALESCE(p_duration_unit, 'minutes'),
      years_of_experience = p_years_of_experience,
      home_service_available = COALESCE(p_home_service_available, false),
      time_slot_duration = p_time_slot_duration,
      max_bookings_per_day = p_max_bookings_per_day,
      portfolio_images = COALESCE(p_portfolio_images, '[]'::jsonb),
      updated_at = NOW()
    WHERE id = v_item_id AND service_id = p_service_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Service item % not found for this store', p_item_id;
    END IF;

    DELETE FROM service_availability WHERE service_item_id = v_item_id;
    DELETE FROM service_locations WHERE service_item_id = v_item_id;
    DELETE FROM service_addons WHERE service_item_id = v_item_id;
  ELSE
    INSERT INTO service_items (
      service_id, name, description, category, sub_category, price, duration,
      duration_unit, years_of_experience, home_service_available,
      time_slot_duration, max_bookings_per_day, portfolio_images, is_active
    ) VALUES (
      p_service_id, p_name, p_description, p_category, p_sub_category, p_price,
      p_duration, COALESCE(p_duration_unit, 'minutes'), p_years_of_experience,
      COALESCE(p_home_service_available, false),
      p_time_slot_duration, p_max_bookings_per_day,
      COALESCE(p_portfolio_images, '[]'::jsonb), true
    ) RETURNING id INTO v_item_id;
  END IF;

  INSERT INTO service_availability (service_item_id, day_of_week, is_available, opening_time, closing_time)
  SELECT
    v_item_id,
    elem->>'day',
    COALESCE((elem->>'isAvailable')::boolean, true),
    NULLIF(elem->>'openingTime', '')::time,
    NULLIF(elem->>'closingTime', '')::time
  FROM jsonb_array_elements(COALESCE(p_availability, '[]'::jsonb)) elem;

  INSERT INTO service_locations (service_item_id, cover_all_nigeria, state, cover_all_cities, cities)
  SELECT
    v_item_id,
    COALESCE((p_locations->>'coverAllNigeria')::boolean, false),
    elem->>'state',
    COALESCE((elem->>'coverAllCities')::boolean, false),
    COALESCE(elem->'cities', '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_locations->'states', '[]'::jsonb)) elem;

  -- Nationwide with no per-state rows still needs one row so
  -- loadServiceDocument (services.js) has something to read coverAllNigeria
  -- off of -- mirrors the same fallback the old app-level code had.
  IF COALESCE((p_locations->>'coverAllNigeria')::boolean, false)
     AND jsonb_array_length(COALESCE(p_locations->'states', '[]'::jsonb)) = 0 THEN
    INSERT INTO service_locations (service_item_id, cover_all_nigeria, state, cover_all_cities, cities)
    VALUES (v_item_id, true, NULL, false, '[]'::jsonb);
  END IF;

  INSERT INTO service_addons (service_item_id, name, price)
  SELECT v_item_id, elem->>'name', COALESCE((elem->>'price')::numeric, 0)
  FROM jsonb_array_elements(COALESCE(p_add_ons, '[]'::jsonb)) elem
  WHERE TRIM(COALESCE(elem->>'name', '')) <> '';

  RETURN v_item_id;
END;
$$;

ALTER TABLE service_items DROP COLUMN IF EXISTS discount;

NOTIFY pgrst, 'reload schema';
