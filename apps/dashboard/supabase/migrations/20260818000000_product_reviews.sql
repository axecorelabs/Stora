-- Product-level reviews, verified-purchase only: a customer can review a
-- product only if they have a delivered order containing it (enforced at
-- the API layer -- see apps/store/src/lib/supabaseReviews.js -- since
-- "delivered" here is orders.status, not a maintained per-item enum; see
-- that file's comment for why). One review per customer per product,
-- editable (re-submitting updates it) rather than resubmittable.
--
-- Rolls up two ways, same trigger-maintained-column pattern as
-- inventory.sold_quantity (20260817000007): inventory.average_rating/
-- total_reviews for the specific product, and stores.average_rating/
-- total_reviews (pre-existing but previously dead columns -- see that
-- migration's history) aggregated across ALL of that store's product
-- reviews.

CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX idx_product_reviews_product_active ON product_reviews(product_id) WHERE is_active;
CREATE INDEX idx_product_reviews_store_active ON product_reviews(store_id) WHERE is_active;
CREATE INDEX idx_product_reviews_customer ON product_reviews(customer_id);

-- Matches this schema's established convention (see
-- 20260717000000_initial_schema.sql's blanket RLS-enable loop): enabled
-- with no policies. Every app route reads/writes via the service-role
-- client, which bypasses RLS by design -- this just ensures no
-- anon/authenticated-role client could hit the table directly through
-- PostgREST without an explicit policy being added later.
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION fn_sync_review_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
  v_store_id UUID := COALESCE(NEW.store_id, OLD.store_id);
BEGIN
  UPDATE inventory SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2) FROM product_reviews
      WHERE product_id = v_product_id AND is_active
    ), 0),
    total_reviews = (
      SELECT COUNT(*) FROM product_reviews WHERE product_id = v_product_id AND is_active
    )
  WHERE id = v_product_id;

  UPDATE stores SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2) FROM product_reviews
      WHERE store_id = v_store_id AND is_active
    ), 0),
    total_reviews = (
      SELECT COUNT(*) FROM product_reviews WHERE store_id = v_store_id AND is_active
    )
  WHERE id = v_store_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_review_aggregates_insert
  AFTER INSERT ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_review_aggregates();

CREATE TRIGGER trg_sync_review_aggregates_update
  AFTER UPDATE OF rating, is_active ON product_reviews
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION fn_sync_review_aggregates();

CREATE TRIGGER trg_sync_review_aggregates_delete
  AFTER DELETE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_review_aggregates();
