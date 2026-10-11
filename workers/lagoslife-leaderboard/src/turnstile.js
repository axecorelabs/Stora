const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Ported from apps/store/src/lib/turnstile.js, reading env.TURNSTILE_SECRET_KEY
// (a Worker secret) instead of process.env. Same fail-CLOSED behavior as
// that version: Turnstile IS the real work here, so a verify call that
// errors or times out must reject the submission, not silently let it
// through. The one exception is the secret being unset entirely, treated
// as "not configured yet" so the Worker can be deployed before Turnstile
// is wired up, rather than rejecting every submission.
export async function verifyTurnstileToken(env, token, remoteIp) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const params = new URLSearchParams();
  params.append('secret', env.TURNSTILE_SECRET_KEY);
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
