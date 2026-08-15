import { OAuth2Client } from 'google-auth-library';

export function getGoogleClient() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
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
