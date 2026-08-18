-- Vendor operating-state + a Nigeria geopolitical-zone proximity helper.
-- Delivery itself is nationwide for every vendor (no eligibility gating) --
-- this is purely a discovery signal: a location badge, an optional hard
-- filter, and an optional "nearest to me" sort, none of which should ever
-- hide a vendor who can genuinely still ship to a buyer.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS state TEXT;

-- Backfill from the existing unstructured address blob. Most rows will
-- stay NULL (online-only vendors never had a state field to fill in) --
-- that's expected and handled by the dashboard nudge banner, not a bug in
-- this migration.
UPDATE stores SET state = NULLIF(TRIM(address->>'state'), '') WHERE state IS NULL;

CREATE INDEX IF NOT EXISTS idx_stores_state
  ON stores (state)
  WHERE is_active = true;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_state TEXT;

-- No CHECK constraint against the canonical 37-state list on either new
-- column: the address->>'state' backfill above is free-text with no prior
-- validation and may contain values that don't match any canonical state
-- (typos, "Lagos State", a city typed into the wrong field) -- a CHECK
-- here could fail the migration outright on a single bad legacy row.
-- Validation instead lives at the API layer, checked against
-- @stora/shared-constants's NIGERIAN_STATES.

-- Static state -> geopolitical-zone lookup, mirroring
-- packages/shared-constants/nigerian-states.js's STATE_TO_ZONE map
-- byte-for-byte on the state strings. Nigeria's 6 zones are about as
-- static as data gets, so this ships as a hardcoded CASE rather than a
-- seeded reference table + join on the hot search path. If a state is
-- ever added/renamed, update the JS map too -- there is no single shared
-- source across JS and SQL.
CREATE OR REPLACE FUNCTION fn_ng_state_zone(p_state TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT CASE p_state
    WHEN 'Benue' THEN 'North Central' WHEN 'Kogi' THEN 'North Central' WHEN 'Kwara' THEN 'North Central'
    WHEN 'Nasarawa' THEN 'North Central' WHEN 'Niger' THEN 'North Central' WHEN 'Plateau' THEN 'North Central'
    WHEN 'FCT' THEN 'North Central'
    WHEN 'Adamawa' THEN 'North East' WHEN 'Bauchi' THEN 'North East' WHEN 'Borno' THEN 'North East'
    WHEN 'Gombe' THEN 'North East' WHEN 'Taraba' THEN 'North East' WHEN 'Yobe' THEN 'North East'
    WHEN 'Jigawa' THEN 'North West' WHEN 'Kaduna' THEN 'North West' WHEN 'Kano' THEN 'North West'
    WHEN 'Katsina' THEN 'North West' WHEN 'Kebbi' THEN 'North West' WHEN 'Sokoto' THEN 'North West'
    WHEN 'Zamfara' THEN 'North West'
    WHEN 'Abia' THEN 'South East' WHEN 'Anambra' THEN 'South East' WHEN 'Ebonyi' THEN 'South East'
    WHEN 'Enugu' THEN 'South East' WHEN 'Imo' THEN 'South East'
    WHEN 'Akwa Ibom' THEN 'South South' WHEN 'Bayelsa' THEN 'South South' WHEN 'Cross River' THEN 'South South'
    WHEN 'Delta' THEN 'South South' WHEN 'Edo' THEN 'South South' WHEN 'Rivers' THEN 'South South'
    WHEN 'Ekiti' THEN 'South West' WHEN 'Lagos' THEN 'South West' WHEN 'Ogun' THEN 'South West'
    WHEN 'Ondo' THEN 'South West' WHEN 'Osun' THEN 'South West' WHEN 'Oyo' THEN 'South West'
    ELSE NULL
  END;
$$;
