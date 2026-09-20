-- website_path was only ever stored inside the website JSONB blob, with no
-- index and no real uniqueness constraint -- isWebsitePathTaken's
-- check-then-set against a JSONB containment query is a genuine race at
-- real signup volume, and that same unindexed containment scan is also
-- the fallback path every storefront request takes whenever a vendor's
-- custom address (rather than their auto-generated store_slug) is what
-- was requested -- exactly the path about to become the COMMON case once
-- internal links start preferring it. store_slug already gets this
-- treatment (see 20260717000000_initial_schema.sql); website_path needs
-- the same.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS website_path VARCHAR(63);

-- Backfill from the existing JSONB value. normalizeWebsitePath
-- (apps/dashboard/src/lib/websitePath.js) already lowercases/trims on
-- write, so existing values should already be clean -- lower()/trim()
-- here anyway as a defensive backfill, not an assumption.
UPDATE stores
SET website_path = lower(trim(website->>'websitePath'))
WHERE website->>'websitePath' IS NOT NULL
  AND trim(website->>'websitePath') <> '';

-- Partial (WHERE NOT NULL) so multiple stores that have never set a custom
-- address -- website_path NULL, falling back to store_slug -- don't
-- collide with each other under the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS stores_website_path_unique
  ON stores(website_path)
  WHERE website_path IS NOT NULL;

NOTIFY pgrst, 'reload schema';
