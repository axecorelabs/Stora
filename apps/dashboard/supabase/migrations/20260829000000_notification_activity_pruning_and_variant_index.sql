-- Perf audit follow-up (2026-08-29). Two independent fixes:

-- 1. notifications and inventory_activities had no retention job at all --
-- unlike sessions/customer_sessions (see 20260822000002), which already get
-- pruned hourly, these two just grow forever. Not urgent today (73 orders
-- total platform-wide), but the risk is silent: nothing fails loudly as
-- these tables grow, they just slowly bloat storage and degrade their own
-- indexes. daily (not hourly -- much lower churn than sessions) pg_cron
-- job, offset from the existing hourly session job and the Vercel crons
-- (3am/4am/6am) so nothing runs concurrently.
--
-- notifications: respects an explicit expires_at when one is set (nothing
-- sets it today, but the column exists for exactly this), and otherwise
-- falls back to a 90-day age cutoff -- plenty of time for a vendor to have
-- seen an in-app notification.
--
-- inventory_activities: a vendor-facing audit trail (stock/price/status
-- changes), not a notification feed -- kept longer (180 days) since it's
-- reasonable for a vendor to want to look back further on "what changed
-- and when" than they would on a notification.
SELECT cron.schedule(
  'prune-notifications-and-activities',
  '0 2 * * *',
  $$
    DELETE FROM notifications
      WHERE (expires_at IS NOT NULL AND expires_at < now())
         OR (expires_at IS NULL AND created_at < now() - interval '90 days');
    DELETE FROM inventory_activities WHERE created_at < now() - interval '180 days';
  $$
);

-- 2. inventory_variants is very commonly queried by (inventory_id,
-- is_active) together (every fetchVariants({activeOnly:true}) call, every
-- storefront attachVariants batch) but only had separate single-column
-- indexes for each half -- Postgres already handles this fine via a
-- bitmap index scan combining both, so this is a minor speed-up, not a
-- correctness fix.
CREATE INDEX IF NOT EXISTS idx_inventory_variants_inventory_active
  ON inventory_variants(inventory_id, is_active);
