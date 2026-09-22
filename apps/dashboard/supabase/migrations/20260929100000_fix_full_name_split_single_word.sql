-- Both sync_user_full_name (users) and sync_customer_full_name (customers)
-- split a Better-Auth-written full_name into first_name/last_name via
-- split_part()/substring(), then wrapped each half in NULLIF(x, '') --
-- turning a genuinely empty half into NULL. That's fatal for a one-word
-- name (e.g. a Google account whose display name is just "Bords"):
-- substring() runs past the end of the string and returns '', NULLIF then
-- turns that into NULL, and last_name is NOT NULL with no default --
-- confirmed live, this was rejecting every Google signup whose account
-- name had no space in it ("Unable to create OAuth user ... null value in
-- column last_name violates not-null constraint").
--
-- A name can legitimately have no last name; the fix is to store that as
-- '' (which first_name/last_name's NOT NULL constraints already require
-- for any name at all), not NULL. Dropping the NULLIF wrapper is the only
-- change -- split_part()/substring() themselves already return '' rather
-- than NULL for an out-of-range slice.

CREATE OR REPLACE FUNCTION sync_user_full_name() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.first_name IS NULL OR NEW.first_name = '') AND NEW.full_name IS NOT NULL AND NEW.full_name <> '' THEN
      NEW.first_name := split_part(NEW.full_name, ' ', 1);
      NEW.last_name := trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2));
    END IF;
    NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  ELSE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      NEW.first_name := split_part(NEW.full_name, ' ', 1);
      NEW.last_name := trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_customer_full_name() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.first_name IS NULL OR NEW.first_name = '') AND NEW.full_name IS NOT NULL AND NEW.full_name <> '' THEN
      NEW.first_name := split_part(NEW.full_name, ' ', 1);
      NEW.last_name := trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2));
    END IF;
    NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  ELSE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      NEW.full_name := TRIM(BOTH ' ' FROM COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      NEW.first_name := split_part(NEW.full_name, ' ', 1);
      NEW.last_name := trim(substring(NEW.full_name from length(split_part(NEW.full_name, ' ', 1)) + 2));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
