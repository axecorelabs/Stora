-- Staff-authored site announcements (new campaigns, reward payouts,
-- general news) -- shown in the header's quick popover (latest few) and
-- on the dedicated /announcements page (full history). No review queue
-- needed -- only an admin (Basic Auth gated) can ever create one.
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_announcements_created ON announcements (created_at DESC);
