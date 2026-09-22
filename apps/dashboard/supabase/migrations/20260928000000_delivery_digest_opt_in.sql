-- The morning delivery-digest Telegram message is opt-in, not automatic --
-- a vendor must explicitly enable it (Deliveries page > Delivery Settings)
-- even after connecting Telegram, since Telegram is also used for order
-- notifications and connecting it shouldn't silently enroll someone in a
-- second, unrelated daily message.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_digest_enabled BOOLEAN NOT NULL DEFAULT false;
