import { redis, withTimeout } from "./redis";

// Per-customer daily quota, distinct from proxy.js's IP-keyed
// authLimiters bucket on these same routes (that one is a generic abuse
// backstop; this one is the actual product rule -- "N try-ons per
// customer per day" -- keyed by customer so a shared office/cafe IP
// doesn't share one customer's allowance, and a customer switching
// networks doesn't get a free reset). Modeled on accountLockout.js's
// incr+expire idiom. Fails open on Redis errors: this guards cost/UX, not
// security -- Turnstile (fails closed) is the real gate on the upload step.
const NS = "store:tryon";
const DAILY_LIMIT = 5;
const WINDOW_SECONDS = 24 * 60 * 60;

const dailyKey = (customerId) => `${NS}:daily:${customerId}`;

export async function isOverDailyLimit(customerId) {
  try {
    const count = Number(await withTimeout(redis.get(dailyKey(customerId)))) || 0;
    return count >= DAILY_LIMIT;
  } catch (error) {
    console.error("Try-on rate limit check failed, allowing request:", error);
    return false;
  }
}

export async function recordAttempt(customerId) {
  try {
    const count = await withTimeout(redis.incr(dailyKey(customerId)));
    if (count === 1) {
      await withTimeout(redis.expire(dailyKey(customerId), WINDOW_SECONDS));
    }
  } catch (error) {
    console.error("Try-on rate limit tracking failed, skipping:", error);
  }
}

// Called when a generation fails/times out -- a flaky model shouldn't
// burn the customer's daily allowance. Floors at 0 rather than going
// negative if this races with a fresh recordAttempt.
export async function releaseAttempt(customerId) {
  try {
    const remaining = await withTimeout(redis.decr(dailyKey(customerId)));
    if (remaining < 0) {
      await withTimeout(redis.set(dailyKey(customerId), '0', { keepTtl: true }));
    }
  } catch (error) {
    console.error("Try-on rate limit release failed, skipping:", error);
  }
}

export const TRYON_DAILY_LIMIT = DAILY_LIMIT;
