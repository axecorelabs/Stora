-- Gates the new first-run onboarding wizard (name confirmation + store
-- creation, the two hard blockers) -- NULL means "hasn't completed it
-- yet", set once by POST /api/stores on successful store creation (the
-- single point true for both the wizard and any other path that creates
-- a store).
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Every vendor who already has a store today has already done the
-- real-world equivalent of the two hard blockers under the old flow --
-- backfill so this ships without interrupting a single existing user.
UPDATE users SET onboarding_completed_at = now()
WHERE id IN (SELECT owner_id FROM stores) AND onboarding_completed_at IS NULL;
