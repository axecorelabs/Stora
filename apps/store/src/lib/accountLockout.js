import { redis, failedKey, lockoutKey, withTimeout } from "./redis";

// Extracted from the original apps/store/src/app/api/auth/customer/login/
// route.js (where this logic used to live inline) so both that route and
// the Better Auth sign-in hook (apps/store/src/lib/betterAuth.js) can use
// the exact same lockout behavior -- not two copies that could drift.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

export async function isLockedOut(email) {
  try {
    return Boolean(await withTimeout(redis.get(lockoutKey(email))));
  } catch (error) {
    console.error('Lockout check failed, allowing request:', error);
    return false;
  }
}

export async function recordFailedAttempt(email) {
  try {
    const attempts = await withTimeout(redis.incr(failedKey(email)));
    if (attempts === 1) {
      await withTimeout(redis.expire(failedKey(email), LOCKOUT_WINDOW_SECONDS));
    }
    if (attempts >= LOCKOUT_THRESHOLD) {
      await withTimeout(redis.set(lockoutKey(email), '1', { ex: LOCKOUT_WINDOW_SECONDS }));
    }
  } catch (error) {
    console.error('Failed-attempt tracking failed, skipping:', error);
  }
}

export async function clearFailedAttempts(email) {
  try {
    await withTimeout(redis.del(failedKey(email), lockoutKey(email)));
  } catch (error) {
    console.error('Failed-attempt cleanup failed, skipping:', error);
  }
}
