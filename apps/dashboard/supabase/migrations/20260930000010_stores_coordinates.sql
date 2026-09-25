-- Real coordinates, mostly for OSM-seeded listings (OpenStreetMap gives
-- every node a lat/lon for free -- and `out center;` gives one for
-- ways/relations too -- previously discarded entirely by the import
-- script). Plain DOUBLE PRECISION columns, not PostGIS: no customer-side
-- precise location exists yet to pair distance queries against (delivery
-- state is state-level only), so full geospatial indexing has nothing to
-- earn its complexity against right now. Lets the showcase page's map
-- drop a real pin instead of geocoding a text address query.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
