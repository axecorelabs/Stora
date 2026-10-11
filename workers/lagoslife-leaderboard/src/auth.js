// Email+password login for this Worker's own lightweight accounts (see
// migrations/0002_accounts.sql for why this is separate from Stora's real
// customer/vendor login). Sessions are opaque high-entropy bearer tokens
// stored in D1, carried in an HttpOnly cookie -- not signed JWTs, since a
// straight DB lookup per request is simpler and plenty fast at this scale.
//
// Password hashing uses PBKDF2-SHA256 via the Web Crypto API (SubtleCrypto)
// -- available natively in Workers, needs no dependency. bcrypt/argon2
// would need either a native binding (unsupported in the Workers sandbox)
// or a pure-JS package; PBKDF2 with a high iteration count is a reasonable
// built-in alternative for this trust level.

const SESSION_COOKIE = 'lagoslife_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PBKDF2_ITERATIONS = 100000;

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Returns {hash, salt} (both hex). Pass an existing `saltHex` to verify a
// password against a stored hash -- the same salt must be used to derive
// a comparable hash.
export async function derivePasswordHash(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await derivePasswordHash(password, saltHex);
  return timingSafeEqual(hash, expectedHashHex);
}

export function generateSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function sessionCookieHeader(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=');
    if (cookieName === name) return rest.join('=');
  }
  return null;
}

export function readSessionToken(request) {
  return readCookie(request, SESSION_COOKIE);
}

// Anonymous presence/visitor-count cookie -- same first-party, this-site-
// only cookie model Lagos Life itself uses, not third-party tracking. Not
// HttpOnly: nothing sensitive in it, and there's no reason client JS would
// ever need to read it anyway since the ping endpoint is same-origin and
// the browser attaches cookies automatically.
const VISITOR_COOKIE = 'lagoslife_visitor_id';
const VISITOR_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;

export function readVisitorId(request) {
  return readCookie(request, VISITOR_COOKIE);
}

export function visitorCookieHeader(visitorId) {
  return `${VISITOR_COOKIE}=${visitorId}; Secure; SameSite=Lax; Path=/; Max-Age=${VISITOR_COOKIE_TTL_SECONDS}`;
}

// Separate cookie/table from the public account session above -- an
// admin login and a public leaderboard-account login must never be
// readable as each other. Shorter TTL (7 days vs. the public account's
// 30) is appropriate for a staff-access credential.
const ADMIN_SESSION_COOKIE = 'lagoslife_admin_session';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function readAdminSessionToken(request) {
  return readCookie(request, ADMIN_SESSION_COOKIE);
}

export function adminSessionCookieHeader(token) {
  return `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`;
}

export function clearAdminSessionCookieHeader() {
  return `${ADMIN_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export { SESSION_TTL_SECONDS, ADMIN_SESSION_TTL_SECONDS };
