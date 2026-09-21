const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Bot check on customer registration, verified server-side -- the
// client-side widget token alone proves nothing, since it's just whatever
// the browser sent.
//
// Deliberately the OPPOSITE fail behavior from this app's Redis cache
// helpers (lib/redis.js, always fail-open): those guard optional
// conveniences where a miss just means "hit Postgres instead," but
// Turnstile IS the real work here -- silently letting every signup through
// during a Cloudflare hiccup would defeat the point of having a bot gate.
// So a verify call that errors or times out fails CLOSED (returns false),
// not open. The one exception is TURNSTILE_SECRET_KEY being unset entirely,
// which is treated as "not configured yet" rather than "reject everyone" --
// this lets the feature ship dark and get turned on later purely by setting
// env vars (client site key + this secret key together), no redeploy of
// this logic needed.
export async function verifyTurnstileToken(token, remoteIp) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const params = new URLSearchParams();
  params.append('secret', process.env.TURNSTILE_SECRET_KEY);
  params.append('response', token);
  if (remoteIp) params.append('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: params,
      signal: controller.signal
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification request failed:', error.message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
