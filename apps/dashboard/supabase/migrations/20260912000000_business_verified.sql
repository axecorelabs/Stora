-- Splits "this person's identity is confirmed" (stores.is_verified, set by
-- the vendor themselves via QoreID NIN + live selfie) from "Stora has
-- vetted this business" (the public "Verified by Stora" badge) -- today
-- both concepts collapse onto the same is_verified flag, and
-- VerificationForm.js's own copy already promises the individual identity
-- check earns the public badge, which is the exact conflation being fixed.
--
-- NULL means not business-verified, same convention onboarding_completed_at
-- and legal_review_pending_at already use in this schema. There's no
-- self-serve request flow for this -- a vendor contacts Stora directly and
-- staff decide, so a single admin-settable timestamp is enough; no
-- request/review-queue table needed for a problem that doesn't exist yet.
ALTER TABLE stores ADD COLUMN business_verified_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
