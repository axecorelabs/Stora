-- verifySession()/verifyCustomerSession() filter on session_id on every
-- single authenticated request in both apps, but neither table had an
-- index on that column (only user_id/customer_id/expires_at/is_active were
-- indexed) -- every session check was scanning the table instead of doing
-- an index lookup, and getting linearly slower as sessions accumulate since
-- nothing prunes expired rows. Unique because session_id is a
-- cryptographically random token (crypto.randomUUID() / randomBytes(32))
-- that should never collide -- the constraint doubles as a safety check.

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_sessions_session_id ON customer_sessions(session_id);
