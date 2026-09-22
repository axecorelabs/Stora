-- Tracks the last time a vendor was sent the morning delivery-digest
-- Telegram message, so the cron job (which may retry or be re-triggered
-- the same day) never sends the same vendor two digests for one day.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_delivery_digest_sent_at TIMESTAMPTZ;
