-- Optional close time for the daily reveal window, same representation
-- as reveal_seconds_of_day (seconds since Lagos midnight). NULL keeps
-- today's behaviour -- once revealed, the board stays open for the rest
-- of the day. When set, the board re-gates at this time each day
-- (closeSecondsOfDay must be later than reveal_seconds_of_day within the
-- same calendar day -- no overnight-wrapping window support), giving a
-- tighter "sneak peek" window instead of "open all evening."
ALTER TABLE campaigns ADD COLUMN close_seconds_of_day INTEGER;
