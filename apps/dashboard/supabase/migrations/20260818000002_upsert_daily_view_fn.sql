-- Used by apps/store/src/app/api/analytics/flush/route.js (a Vercel Cron
-- job, called only via the service-role client) to additively upsert a
-- batched Redis view count into store_daily_views/product_daily_views.
-- Plain supabase-js .upsert() does a REPLACE on conflict (views =
-- EXCLUDED.views); this needs views = existing + EXCLUDED.views instead,
-- since each flush is a delta on top of whatever was already recorded
-- earlier the same day, not the day's full total.
--
-- p_table/p_id_column are never derived from request input -- the flush
-- route always passes one of two hardcoded literal pairs
-- ('store_daily_views','store_id') or ('product_daily_views',
-- 'product_id'). format(%I) safely quotes them as identifiers regardless,
-- and both tables have RLS enabled with no policies (see
-- 20260818000001_visitor_analytics.sql), so even a hypothetical direct
-- call by a non-service-role client would be denied at the row level --
-- same defense-in-depth posture as every other RPC in this schema.
CREATE OR REPLACE FUNCTION fn_upsert_daily_view(
  p_table TEXT,
  p_id_column TEXT,
  p_id UUID,
  p_date DATE,
  p_views INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'INSERT INTO %I (%I, view_date, views) VALUES ($1, $2, $3)
     ON CONFLICT (%I, view_date) DO UPDATE SET views = %I.views + EXCLUDED.views',
    p_table, p_id_column, p_id_column, p_table
  ) USING p_id, p_date, p_views;
END;
$$;
