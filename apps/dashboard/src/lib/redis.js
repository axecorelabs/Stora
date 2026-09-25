import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export const redis = Redis.fromEnv();

// Both apps share one physical Redis database -- every key must be
// namespaced per app to avoid collisions.
export const NS = 'dashboard';

export const sessionKey = (sessionId) => `${NS}:session:${sessionId}`;
export const failedKey = (email) => `${NS}:failed:${email}`;
export const lockoutKey = (email) => `${NS}:lockout:${email}`;
// Telegram account-linking code -> storeId, single-use, short TTL (see
// POST /api/telegram/link and the webhook handler that redeems it).
export const telegramLinkKey = (code) => `${NS}:telegram-link:${code}`;
// Business-claim email-OTP code, keyed by the store being claimed (not by
// user -- the code verifies control of the STORE's own listed email, not
// the claimant's account). Overwritten on every "send code" request, so
// requesting a new one invalidates the last, same UX as any other OTP.
export const claimCodeKey = (storeId) => `${NS}:claim-code:${storeId}`;

// Bounds worst-case latency so a hung (not just erroring) Redis call can
// never stall a request -- pairs with try/catch fail-open everywhere.
export async function withTimeout(promise, ms = 750) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), ms))
  ]);
}

// The store app caches its public storefront payload (GET /api/store/[slug])
// with a short TTL -- fine for most edits, but a branding change or a
// website enable/disable toggle should be visible to shoppers immediately,
// not up to 2 minutes later. Both apps share one physical Redis database,
// so this reaches directly into the store app's cache-key format to bust
// it. Deliberately hardcoded rather than imported (cross-app import isn't
// possible between these two Next.js apps) -- if
// apps/store/src/lib/redis.js's cacheKey.storeBySlug format ever changes,
// this must change with it.
// Keyed by store_id, not IP -- unlike the store app's authLimiters
// (apps/store/src/proxy.js), which guard pre-auth flows where IP is the
// only identity available. This route is post-auth and per-vendor, so
// IP-keying would be the wrong scope (shared NAT wouldn't actually stop
// one account retrying) and would also let one vendor exhaust a limit
// shared with others behind the same IP. Called directly in the route,
// not via middleware, since it needs the authenticated store_id.
export const verificationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '24 h'),
  prefix: 'dashboard:rl:verification'
});

// Guards POST /api/telegram/link -- a vendor re-clicking "Connect" a few
// times while waiting is normal, generating a fresh code on every request
// forever isn't.
export const telegramLinkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'dashboard:rl:telegram-link'
});

// Claim flow limiters -- keyed by the authenticated claimant's user id
// (post-auth, same reasoning as verificationLimiter above: IP-keying would
// be the wrong scope here). Separate limiters for send-code (bounds email
// spam to a business's inbox) and verify (bounds brute-forcing a 6-digit
// code against the send-code limiter's own pace).
export const claimSendCodeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'dashboard:rl:claim-send-code'
});
export const claimVerifyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'dashboard:rl:claim-verify'
});

export async function invalidateStorefrontCache(slug) {
  if (!slug) return;
  try {
    await withTimeout(redis.del(`store:cache:store:${slug}`));
  } catch (error) {
    // Self-heals via the store app's own TTL on that key -- not a new hole.
    console.warn('Storefront cache invalidation failed, skipping:', slug, error.message);
  }
}
