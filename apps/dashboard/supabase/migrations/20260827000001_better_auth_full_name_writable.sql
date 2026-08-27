-- Fixes 20260827000000: full_name was a GENERATED ALWAYS AS ... STORED
-- column, which Postgres rejects any direct write to (even an identical
-- value) -- confirmed live: Better Auth's signUpEmail writes `name`
-- directly to whatever column user.fields.name maps to, and Postgres
-- error 428C9 ("cannot insert a non-DEFAULT value into column") rejected
-- it outright. A regular column kept in sync by a trigger allows writes
-- from either side (this app's existing first_name/last_name updates, or
-- Better Auth writing a single `name` value) while still keeping both
-- representations consistent, in both directions.

ALTER TABLE customers ALTER COLUMN full_name DROP EXPRESSION IF EXISTS;
-- DROP EXPRESSION leaves the column as a plain, independently-writable
-- text column with whatever value was already stored -- no data is lost.

CREATE OR REPLACE FUNCTION sync_customer_full_name() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A Better Auth signup writes full_name (via its `name` field) with
    -- first_name/last_name left null -- split it once so the rest of the
    -- app (which reads first_name/last_name everywhere: order emails,
    -- customer displays, etc.) still has something sensible.
    IF (NEW.first_name IS NULL OR NEW.first_name = '') AND NEW.full_name IS NOT NULL AND NEW.full_name <> '' THEN
      NEW.first_name := NULLIF(split_part(NEW.full_name, ' ', 1), '');
      NEW.last_name := NULLIF(trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2)), '');
    END IF;
    NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  ELSE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      -- This app's own existing code updated first/last name -- recompute
      -- full_name from that, same as the old generated column did.
      NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      -- Better Auth (or anything else) wrote full_name directly -- split
      -- it back into first/last so both stay consistent either way.
      NEW.first_name := NULLIF(split_part(NEW.full_name, ' ', 1), '');
      NEW.last_name := NULLIF(trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2)), '');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_full_name ON customers;
CREATE TRIGGER trg_sync_customer_full_name
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION sync_customer_full_name();
