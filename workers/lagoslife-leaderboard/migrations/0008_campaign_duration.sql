-- Optional scheduled end time for a campaign. NULL keeps today's
-- behaviour (manual-only -- runs until a staffer ends it). When set, the
-- campaign is lazily auto-ended the next time its status is checked
-- (see getActiveCampaign) once this time passes -- no cron trigger
-- needed, consistent with how ad slot expiry already works in this app.
ALTER TABLE campaigns ADD COLUMN ends_at INTEGER;
