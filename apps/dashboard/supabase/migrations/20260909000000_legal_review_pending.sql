-- Backstop for the gap legal_acceptances (20260908000000) didn't close on
-- its own: Google OAuth sign-up (in either app) creates an account with no
-- consent step at all -- there's no checkbox to check on that path, so
-- there was nothing for the email/password routes' own explicit
-- recordLegalAcceptance() call to mirror.
--
-- legal_review_pending_at is a fail-safe default, not an opt-in flag: a new
-- databaseHooks.user.create.after hook (fires for EVERY new row, any
-- creation path, same as the existing trial-subscription hook on
-- apps/dashboard) sets it to NOW() on every account the moment it's
-- created. The two paths that actually capture real consent --
-- email/password registration (already logs to legal_acceptances) and the
-- new post-OAuth "review and accept" interstitial -- are each responsible
-- for clearing it back to NULL once they do. A future signup path nobody
-- remembers to wire consent-clearing into fails CLOSED (user stays gated
-- at the review screen) rather than silently exempt, which is what
-- actually happened with Google before this migration.
--
-- NULL means "no review needed" -- existing rows default to NULL so no
-- current user is retroactively locked out; only rows created from here on
-- ever get a non-NULL value from the hook.
ALTER TABLE customers ADD COLUMN legal_review_pending_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users ADD COLUMN legal_review_pending_at TIMESTAMPTZ DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
