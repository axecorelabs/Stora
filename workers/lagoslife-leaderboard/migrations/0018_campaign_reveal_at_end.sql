-- A third reveal mode, alongside "immediate" (reveal_seconds_of_day and
-- close_seconds_of_day both null) and "daily schedule" (reveal_seconds_of_day
-- set, optional close_seconds_of_day sneak-peek window): withhold every
-- result completely until the campaign itself ends -- no recurring daily
-- reveal at all. Mutually exclusive with those two columns at the
-- application level (enforced in handleAdminStartCampaign, which forces
-- them to null whenever this is set) -- isCampaignRevealedNow checks this
-- column first and short-circuits, so the other two are simply ignored
-- rather than needing a CHECK constraint to prove the exclusivity.
ALTER TABLE campaigns ADD COLUMN reveal_at_end INTEGER NOT NULL DEFAULT 0;
