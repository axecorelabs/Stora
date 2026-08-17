-- Website/product view analytics. The read path this whole migration
-- exists to make safe: a naive "UPDATE stores SET views = views + 1" (or
-- worse, the JSONB read-modify-write the old, uncalled
-- /api/stores/public/[websitePath]/metrics route did) on every single
-- pageview is exactly what melts a DB under real traffic -- every visitor
-- becomes a write, and popular stores get hammered with row-lock
-- contention. Real pageview counting lives in Redis (INCR per store/
-- product per day, see apps/store/src/lib/analytics.js) and only reaches
-- Postgres via a periodic batched flush (apps/store/src/app/api/
-- analytics/flush/route.js, a Vercel Cron job) -- one upsert per store per
-- flush interval instead of one write per visitor.
--
-- Date-bucketed (not a single running total) so "views this week/month"
-- is a real query against real rows, not another dead JSONB field nobody
-- populates -- which is exactly what apps/dashboard's website stats strip
-- (Total Views / Monthly Views / Total Orders / Last Visit) had been
-- silently reading before this migration: store.website.metrics.* was
-- never once written by anything, so it always rendered zero.

CREATE TABLE store_daily_views (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, view_date)
);
CREATE INDEX idx_store_daily_views_store_date ON store_daily_views(store_id, view_date DESC);
ALTER TABLE store_daily_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE product_daily_views (
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, view_date)
);
CREATE INDEX idx_product_daily_views_product_date ON product_daily_views(product_id, view_date DESC);
ALTER TABLE product_daily_views ENABLE ROW LEVEL SECURITY;

-- stores.total_orders was also never maintained (confirmed by an existing
-- comment in apps/dashboard/src/app/dashboard/store/page.js: "the stores
-- table's own total_sales/total_orders columns are never updated by the
-- app" -- that page already works around it by computing real stats from
-- /api/pos/sales/stats instead). It's also what search_vendors()'s
-- "featured" sort orders by (20260817000005/6), so a stale column there
-- silently degrades that sort to its next tiebreaker, not just a display
-- bug. order_stores is keyed one-row-per-order-item (not one-row-per-
-- order), so counting order_stores rows directly would over-count --
-- "how many distinct orders has this store received" has to count
-- DISTINCT (order_id, store_id) pairs from order_items instead.

-- One-time backfill from the real source of truth.
UPDATE stores s SET total_orders = COALESCE((
  SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.store_id = s.id
), 0);

CREATE OR REPLACE FUNCTION fn_sync_store_total_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only count the first line item of a given order that lands at this
  -- store -- a second item in the same order/store pair is the same
  -- order, not a new one.
  IF NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = NEW.order_id AND store_id = NEW.store_id AND id != NEW.id
  ) THEN
    UPDATE stores SET total_orders = total_orders + 1 WHERE id = NEW.store_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_store_total_orders
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_store_total_orders();
