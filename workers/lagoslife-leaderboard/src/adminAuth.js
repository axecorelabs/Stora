// Shared-secret HTTP Basic Auth for /admin* -- not full session auth,
// which would be disproportionate complexity for a side feature separate
// from Stora's core business. env.ADMIN_SECRET is a "username:password"
// string set via `wrangler secret put ADMIN_SECRET`.
//
// Basic Auth over a query-param secret deliberately: a query param leaks
// into Cloudflare/Worker access logs and Referer headers, while the
// Authorization header doesn't, and the browser caches the credential
// for the session after one native prompt -- so the admin page's own
// fetch() calls to /api/admin/review and /admin/screenshot/:id carry it
// automatically with no extra JS needed.

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const UNAUTHORIZED_HEADERS = {
  'WWW-Authenticate': 'Basic realm="Lagos Life Leaderboard Admin"'
};

// Returns a 401 Response if the request isn't authorized, or null if it is.
export function requireBasicAuth(request, env) {
  const expected = env.ADMIN_SECRET || '';
  if (!expected) {
    return new Response('Admin access not configured', { status: 503 });
  }

  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) {
    return new Response('Unauthorized', { status: 401, headers: UNAUTHORIZED_HEADERS });
  }

  let decoded;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return new Response('Unauthorized', { status: 401, headers: UNAUTHORIZED_HEADERS });
  }

  if (!timingSafeEqual(decoded, expected)) {
    return new Response('Unauthorized', { status: 401, headers: UNAUTHORIZED_HEADERS });
  }

  return null;
}
