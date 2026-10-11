-- Fourth social platform alongside Instagram/TikTok/X -- same bare-
-- handle storage convention as migrations/0004_social_links.sql (the
-- profile URL is built from this at read time, not stored).
ALTER TABLE accounts ADD COLUMN snapchat_handle TEXT;
