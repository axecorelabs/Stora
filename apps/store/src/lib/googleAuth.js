import { OAuth2Client } from 'google-auth-library';

// X-Forwarded-Host is client-controllable in general, so it's only trusted
// here when it matches one of this app's own known hosts -- Google itself
// also rejects any redirect_uri outside what's registered in Cloud
// Console, but there's no reason to rely on that alone when a fixed
// allowlist closes the gap directly. Not a moving target: Google requires
// an exact-match registered redirect URI anyway, so a Vercel preview
// deployment's random URL was never going to work regardless.
const ALLOWED_HOSTS = ['stora.com.ng', 'localhost:3001'];

export function getRequestOrigin(req) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost && ALLOWED_HOSTS.includes(forwardedHost)) {
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

// The start/callback routes must derive the same baseUrl since Google's
// token endpoint requires the exact same redirect_uri in both steps.
export function getGoogleClient(baseUrl) {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/google/callback`
  );
}

// Rejects absolute and protocol-relative URLs so a crafted returnTo can't
// redirect off-site (open redirect) -- store is multi-tenant/path-based
// ([slug]/...), so the post-login destination always travels as a path.
export function isSafeReturnTo(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !/^\/[^/]*:/.test(path);
}
