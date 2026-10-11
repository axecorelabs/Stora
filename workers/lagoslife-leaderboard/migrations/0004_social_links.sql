-- Optional social handles shown as icon links on the redesigned profile
-- card. Stored as bare handles (no leading @, no full URL) -- the profile
-- URL is built at read time (see publicAccount() in src/index.js) so a
-- platform's URL scheme can change without a data migration.
ALTER TABLE accounts ADD COLUMN instagram_handle TEXT;
ALTER TABLE accounts ADD COLUMN tiktok_handle TEXT;
ALTER TABLE accounts ADD COLUMN twitter_handle TEXT;
