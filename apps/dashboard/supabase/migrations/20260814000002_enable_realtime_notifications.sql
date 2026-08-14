-- Enable Realtime replication on notifications so the dashboard's SSE relay
-- endpoint (apps/dashboard/src/app/api/notifications/stream/route.js) can
-- subscribe to INSERTs via a service-role Postgres Changes listener, instead
-- of the vendor dashboard only ever finding out about new orders on its next
-- poll. Guarded so this migration is safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
