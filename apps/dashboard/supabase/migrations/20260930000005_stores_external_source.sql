-- Idempotency plumbing for bulk-seeding unclaimed listings from an
-- external dataset (OpenStreetMap, via apps/admin/scripts/
-- import-osm-businesses.mjs). Nullable -- existing rows and manually/
-- suggestion-seeded unclaimed listings (Part B) have neither.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS external_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(64);

-- Lets an import script re-run safely: an already-imported OSM element
-- (same source + id) is skipped, not duplicated. Partial so it never
-- applies to the vast majority of rows that have neither column set.
CREATE UNIQUE INDEX IF NOT EXISTS stores_external_source_id_uq
  ON stores(external_source, external_id)
  WHERE external_source IS NOT NULL;
