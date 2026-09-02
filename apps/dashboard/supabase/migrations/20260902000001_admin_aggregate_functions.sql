-- apps/admin's Overview/Vendors/Products/Payments/Analytics pages were
-- built pulling full row sets (every order_item, every sale, every
-- order_payment_split, sometimes with no date bound at all) into Node and
-- summing them in JS -- functionally correct today at 16 stores/97
-- order_items/18 splits, but it does not scale: every one of those routes
-- would eventually be transferring and re-summing an ever-growing table
-- on every page load instead of asking Postgres to aggregate once,
-- server-side, using indexes that already exist (order_items.store_id,
-- orders.status, sales.user_id/status, order_payment_splits.store_id are
-- all already indexed -- see idx_order_items_store_id,
-- idx_sales_user_id, idx_order_payment_splits_store_id etc). This mirrors
-- the same fix already applied once in this codebase for exactly this
-- reason (fn_inventory_stats, 20260819000001) -- these are that same
-- pattern, scoped to what apps/admin needs.

-- Storefront visibility (stores.is_active AND website->>isEnabled) has no
-- supporting index today -- search_vendors()/search_products()
-- (20260817000006) already filter on this same expression with a
-- sequential scan, and apps/admin's own "published storefronts" count
-- does too. Partial index matches what both actually query for.
CREATE INDEX IF NOT EXISTS idx_stores_published
  ON stores ((website ->> 'isEnabled'))
  WHERE is_active = true;

-- Combined sales (online orders + POS sales) for a set of stores --
-- replaces apps/admin's computeCombinedSales, which pulled every
-- order_item and every sale for the requested stores into JS. One
-- indexed, grouped query instead.
CREATE OR REPLACE FUNCTION fn_admin_combined_sales(p_store_ids UUID[])
RETURNS TABLE(store_id UUID, total_sales NUMERIC)
LANGUAGE sql STABLE
AS $$
  SELECT s.id AS store_id,
    COALESCE(online.total, 0) + COALESCE(pos.total, 0) AS total_sales
  FROM stores s
  LEFT JOIN (
    SELECT oi.store_id, SUM(oi.subtotal) AS total
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.store_id = ANY(p_store_ids)
      AND o.status IN ('processed', 'shipped', 'delivered')
    GROUP BY oi.store_id
  ) online ON online.store_id = s.id
  LEFT JOIN (
    SELECT sa.user_id, SUM(sa.total) AS total
    FROM sales sa
    WHERE sa.status = 'completed'
    GROUP BY sa.user_id
  ) pos ON pos.user_id = s.owner_id
  WHERE s.id = ANY(p_store_ids);
$$;

-- Category rollup across every product -- replaces the Products page's
-- filters route pulling every non-deleted inventory row plus every
-- variant row into JS just to count categories and out-of-stock
-- products. p_active_only lets Overview's topCategories (which only ever
-- wanted active products) and the Products page's filter list (which
-- wants every category regardless of active state) share one function.
CREATE OR REPLACE FUNCTION fn_admin_product_category_stats(p_active_only BOOLEAN DEFAULT false)
RETURNS TABLE(category TEXT, product_count BIGINT, total_stock BIGINT, out_of_stock_count BIGINT)
LANGUAGE sql STABLE
AS $$
  WITH rollup AS (
    SELECT inventory_id, COALESCE(SUM(quantity_in_stock), 0) AS stock
    FROM inventory_variants
    GROUP BY inventory_id
  )
  SELECT COALESCE(i.category, 'Uncategorized') AS category,
    COUNT(*) AS product_count,
    COALESCE(SUM(r.stock), 0) AS total_stock,
    COUNT(*) FILTER (WHERE COALESCE(r.stock, 0) <= 0) AS out_of_stock_count
  FROM inventory i
  LEFT JOIN rollup r ON r.inventory_id = i.id
  WHERE i.is_deleted = false
    AND (NOT p_active_only OR i.is_active = true)
  GROUP BY COALESCE(i.category, 'Uncategorized');
$$;

-- Daily revenue trend (online + POS combined, same channels
-- fn_admin_combined_sales covers) for the Overview page's chart, plus a
-- separate order count per day -- replaces pulling every order/order_item
-- in the window (and, for the all-time total, EVERY eligible order_item
-- ever, completely unbounded) into JS.
CREATE OR REPLACE FUNCTION fn_admin_daily_revenue_trend(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(day DATE, revenue NUMERIC, order_count BIGINT)
LANGUAGE sql STABLE
AS $$
  WITH online AS (
    SELECT date_trunc('day', o.created_at)::date AS day, SUM(oi.subtotal) AS total
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status IN ('processed', 'shipped', 'delivered')
      AND o.created_at >= p_start AND o.created_at < p_end
    GROUP BY 1
  ),
  pos AS (
    SELECT date_trunc('day', sale_date)::date AS day, SUM(total) AS total
    FROM sales
    WHERE status = 'completed' AND sale_date >= p_start AND sale_date < p_end
    GROUP BY 1
  ),
  order_counts AS (
    SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS cnt
    FROM orders
    WHERE created_at >= p_start AND created_at < p_end
    GROUP BY 1
  )
  SELECT d.day,
    COALESCE(online.total, 0) + COALESCE(pos.total, 0) AS revenue,
    COALESCE(order_counts.cnt, 0) AS order_count
  FROM (
    SELECT day FROM online UNION SELECT day FROM pos UNION SELECT day FROM order_counts
  ) d
  LEFT JOIN online ON online.day = d.day
  LEFT JOIN pos ON pos.day = d.day
  LEFT JOIN order_counts ON order_counts.day = d.day;
$$;

-- All-time combined revenue -- one aggregate query instead of loading
-- every eligible order_item and every completed sale ever, unbounded.
CREATE OR REPLACE FUNCTION fn_admin_total_revenue()
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE((
    SELECT SUM(oi.subtotal)
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('processed', 'shipped', 'delivered')
  ), 0) + COALESCE((
    SELECT SUM(total) FROM sales WHERE status = 'completed'
  ), 0);
$$;

-- Platform-wide payment stats -- replaces /api/payments/overview pulling
-- every charged order_payment_splits row (unbounded) into JS to sum.
-- Joined via order_payment_id (the actual FK order_payment_splits
-- carries), matching what PostgREST's own embedded-resource join already
-- resolves to.
CREATE OR REPLACE FUNCTION fn_admin_payments_stats()
RETURNS TABLE(
  total_commission NUMERIC, total_partner_commission NUMERIC, total_paid_out NUMERIC,
  total_pending_payout NUMERIC, total_refunded NUMERIC, total_gross NUMERIC, transaction_count BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(SUM(ops.platform_commission_amount), 0),
    COALESCE(SUM(ops.partner_commission_amount), 0),
    COALESCE(SUM(ops.net_amount_to_vendor - ops.refunded_amount) FILTER (WHERE ops.status = 'settled'), 0),
    COALESCE(SUM(ops.net_amount_to_vendor - ops.refunded_amount) FILTER (WHERE ops.status = 'pending'), 0),
    COALESCE(SUM(ops.refunded_amount), 0),
    COALESCE(SUM(ops.gross_amount), 0),
    COUNT(*)
  FROM order_payment_splits ops
  JOIN order_payments op ON op.id = ops.order_payment_id
  WHERE op.status IN ('completed', 'partially_refunded', 'refunded');
$$;

-- Per-vendor payout breakdown for the Payments page's table -- same
-- source/gate as fn_admin_payments_stats, grouped by store.
CREATE OR REPLACE FUNCTION fn_admin_vendor_payouts()
RETURNS TABLE(
  store_id UUID, gross NUMERIC, commission NUMERIC, net NUMERIC,
  pending_payout NUMERIC, refunded NUMERIC, transaction_count BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT ops.store_id,
    SUM(ops.gross_amount),
    SUM(ops.platform_commission_amount),
    SUM(ops.net_amount_to_vendor - ops.refunded_amount),
    SUM(ops.net_amount_to_vendor - ops.refunded_amount) FILTER (WHERE ops.status = 'pending'),
    SUM(ops.refunded_amount),
    COUNT(*)
  FROM order_payment_splits ops
  JOIN order_payments op ON op.id = ops.order_payment_id
  WHERE op.status IN ('completed', 'partially_refunded', 'refunded')
  GROUP BY ops.store_id;
$$;

-- Daily Paystack-processed volume trend for the Analytics page --
-- replaces pulling every charged split in the window into JS.
CREATE OR REPLACE FUNCTION fn_admin_processing_volume_trend(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(day DATE, gross NUMERIC, transaction_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc('day', ops.created_at)::date AS day,
    SUM(ops.gross_amount), COUNT(*)
  FROM order_payment_splits ops
  JOIN order_payments op ON op.id = ops.order_payment_id
  WHERE op.status IN ('completed', 'partially_refunded', 'refunded')
    AND ops.created_at >= p_start AND ops.created_at < p_end
  GROUP BY 1;
$$;

-- Top stores by Paystack-processed volume since p_start -- replaces
-- pulling every charged split since p_start into JS just to group and
-- sort them; LIMIT is applied in SQL, not after loading everything.
CREATE OR REPLACE FUNCTION fn_admin_top_stores_by_volume(p_start TIMESTAMPTZ, p_limit INT DEFAULT 10)
RETURNS TABLE(store_id UUID, volume NUMERIC)
LANGUAGE sql STABLE
AS $$
  SELECT ops.store_id, SUM(ops.gross_amount) AS volume
  FROM order_payment_splits ops
  JOIN order_payments op ON op.id = ops.order_payment_id
  WHERE op.status IN ('completed', 'partially_refunded', 'refunded')
    AND ops.created_at >= p_start
  GROUP BY ops.store_id
  ORDER BY volume DESC
  LIMIT p_limit;
$$;

-- Trailing-window commission total for the Analytics page's run-rate MRR
-- card -- a plain scalar sum, same gate as fn_admin_payments_stats.
CREATE OR REPLACE FUNCTION fn_admin_commission_in_range(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(ops.platform_commission_amount), 0)
  FROM order_payment_splits ops
  JOIN order_payments op ON op.id = ops.order_payment_id
  WHERE op.status IN ('completed', 'partially_refunded', 'refunded')
    AND ops.created_at >= p_start AND ops.created_at < p_end;
$$;
