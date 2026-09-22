-- Manual override for "closed right now," separate from the weekly
-- business_hours schedule -- covers a vendor closing unexpectedly (ran
-- out of food, emergency, etc.) that the recurring schedule alone can't
-- represent. When true, the store reads as closed regardless of what the
-- weekly schedule says for today.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS temporarily_closed BOOLEAN NOT NULL DEFAULT false;
