-- Direct business-profile ratings for listing showcases.
-- Separate from product_reviews: listing-mode stores need customer ratings
-- of the business itself, not product purchase-based ratings.

CREATE TABLE IF NOT EXISTS listing_profile_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_profile_reviews_store_active
  ON listing_profile_reviews(store_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_listing_profile_reviews_customer
  ON listing_profile_reviews(customer_id);

ALTER TABLE listing_profile_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fn_assert_listing_profile_review_store()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_platform_mode TEXT;
BEGIN
  SELECT platform_mode
  INTO v_platform_mode
  FROM stores
  WHERE id = NEW.store_id;

  IF v_platform_mode IS DISTINCT FROM 'listing' THEN
    RAISE EXCEPTION 'listing_profile_reviews only supports listing-mode stores';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_listing_profile_review_store ON listing_profile_reviews;
CREATE TRIGGER trg_assert_listing_profile_review_store
  BEFORE INSERT OR UPDATE OF store_id ON listing_profile_reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_assert_listing_profile_review_store();

CREATE OR REPLACE FUNCTION fn_sync_listing_profile_review_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_store_id UUID := COALESCE(NEW.store_id, OLD.store_id);
BEGIN
  UPDATE stores
  SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM listing_profile_reviews
      WHERE store_id = v_store_id AND is_active
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM listing_profile_reviews
      WHERE store_id = v_store_id AND is_active
    )
  WHERE id = v_store_id
    AND platform_mode = 'listing';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listing_profile_review_aggregates_insert ON listing_profile_reviews;
CREATE TRIGGER trg_sync_listing_profile_review_aggregates_insert
  AFTER INSERT ON listing_profile_reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_listing_profile_review_aggregates();

DROP TRIGGER IF EXISTS trg_sync_listing_profile_review_aggregates_update ON listing_profile_reviews;
CREATE TRIGGER trg_sync_listing_profile_review_aggregates_update
  AFTER UPDATE OF rating, is_active ON listing_profile_reviews
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION fn_sync_listing_profile_review_aggregates();

DROP TRIGGER IF EXISTS trg_sync_listing_profile_review_aggregates_delete ON listing_profile_reviews;
CREATE TRIGGER trg_sync_listing_profile_review_aggregates_delete
  AFTER DELETE ON listing_profile_reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_listing_profile_review_aggregates();

NOTIFY pgrst, 'reload schema';