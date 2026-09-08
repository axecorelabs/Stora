-- Telegram as a third order-notification channel, alongside the existing
-- in-app `notifications` row and email (see apps/store/src/lib/
-- orderNotifications.js). A vendor links their Telegram account from the
-- dashboard Settings page via one platform-wide bot and a deep-link
-- handshake (POST /api/telegram/link generates a short-lived code stored
-- in Redis, redeemed by the bot's webhook on /start <code>) -- no OAuth,
-- Telegram doesn't have one for this.
--
-- Two columns on stores, not a new table: the linking code itself is
-- transient (Redis only, single-use, short TTL), so steady state is just
-- "is this store linked, and to which chat" -- same reasoning
-- business_verified_at used to avoid a request/review table it didn't
-- need. NULL telegram_chat_id = not connected, matching the
-- nullable-column-as-boolean-gate convention already used throughout this
-- schema (onboarding_completed_at, legal_review_pending_at,
-- business_verified_at).
--
-- BIGINT, not INTEGER: Telegram chat ids can exceed the 32-bit range.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
-- Vendor's Telegram @username (or first name if they have none set) --
-- captured off the /start webhook update purely so the Settings tab can
-- show "Connected as @handle" instead of a bare "Connected" boolean.
-- Never used for anything else; the chat id is the only value actually
-- needed to send a message.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS telegram_username TEXT;

NOTIFY pgrst, 'reload schema';
