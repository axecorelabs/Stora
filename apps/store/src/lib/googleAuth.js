import { OAuth2Client } from 'google-auth-library';

// Prefers X-Forwarded-Host/-Proto (set correctly by Vercel's edge, and
// required if an external proxy/CDN like Cloudflare ever sits in front of
// it) over req.nextUrl.origin, which only reflects the true public host
// when there's no such proxy in the path. Self-correcting across dev,
// prod, and Vercel preview URLs -- no env var to keep in sync.
export function getRequestOrigin(req) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost) {
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
