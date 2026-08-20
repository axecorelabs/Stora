-- 20260814000003_index_session_tokens.sql added a unique index on
-- session_id for both tables, not realizing session_id was already
-- declared UNIQUE in the initial schema -- which Postgres already backs
-- with its own unique index (sessions_session_id_key /
-- customer_sessions_session_id_key). Every write to either table has been
-- maintaining two identical unique indexes since. Drop the redundant ones;
-- the constraint-backed indexes stay and keep doing the same job.
DROP INDEX IF EXISTS idx_sessions_session_id;
DROP INDEX IF EXISTS idx_customer_sessions_session_id;

-- `sessions` already had idx_sessions_expires_at (initial schema), but
-- customer_sessions never got the equivalent -- confirmed via EXPLAIN that
-- the hourly cleanup below would Seq Scan the whole table on every run.
-- customer_sessions is store-side (customer traffic), not dashboard-side
-- (vendor logins), so it's the one actually likely to accumulate enough
-- rows for that to matter.
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);

-- Nothing ever pruned expired rows from either table -- verifySession()/
-- verifyCustomerSession() already filter on expires_at at read time, so an
-- expired row does nothing but take up space and slow down the table's own
-- indexes as it grows. pg_cron runs the cleanup hourly directly in
-- Postgres, rather than adding a new app-level cron route/external
-- scheduler for what's purely db housekeeping.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *',
  $$
    DELETE FROM sessions WHERE expires_at < now();
    DELETE FROM customer_sessions WHERE expires_at < now();
  $$
);
