-- Frozen view count for an ENDED campaign (computed once from the
-- presence Durable Object's per-visitor first_seen/last_seen range --
-- see presenceObject.js's /stats-range route -- and persisted here since
-- that DO only keeps one row per visitor_id, which a LATER campaign's
-- traffic would overwrite if re-queried after the fact). NULL means
-- "not computed yet" -- covers an active campaign (always shown live,
-- never frozen) and an ended campaign nobody has loaded /admin/campaigns
-- for since it ended (backfilled lazily on next view, see
-- ensureCampaignViews in src/index.js).
ALTER TABLE campaigns ADD COLUMN views_count INTEGER;
