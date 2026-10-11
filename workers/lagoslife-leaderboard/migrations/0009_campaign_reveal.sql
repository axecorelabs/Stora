-- Optional per-campaign daily "results reveal" time, in seconds since
-- Lagos (WAT, UTC+1, fixed -- Nigeria has no DST) midnight. NULL keeps
-- today's behaviour (submitting unlocks the leaderboard immediately).
-- When set, someone who's submitted still can't see the leaderboard
-- until this time-of-day is next crossed, in a daily-repeating cycle for
-- as long as the campaign runs -- see isCampaignRevealedNow in index.js.
-- Purely a time-of-day comparison, so no cron/background job is needed.
ALTER TABLE campaigns ADD COLUMN reveal_seconds_of_day INTEGER;
