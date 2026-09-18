-- Allow stores/listings to carry more than one business subcategory.
--
-- business_subcategory remains the primary subcategory for compatibility.
-- business_subcategories is the full list (primary + secondary values).

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS business_subcategories TEXT[];

CREATE INDEX IF NOT EXISTS idx_stores_business_subcategories
  ON stores USING GIN (business_subcategories);

-- Backfill existing primary subcategory into the new list column.
UPDATE stores
SET business_subcategories = ARRAY[business_subcategory]
WHERE business_subcategory IS NOT NULL
  AND btrim(business_subcategory) <> ''
  AND (business_subcategories IS NULL OR array_length(business_subcategories, 1) IS NULL);

NOTIFY pgrst, 'reload schema';
