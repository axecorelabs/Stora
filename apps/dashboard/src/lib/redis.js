import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

// Both apps share one physical Redis database -- every key must be
// namespaced per app to avoid collisions.
export const NS = 'dashboard';

export const sessionKey = (sessionId) => `${NS}:session:${sessionId}`;
export const failedKey = (email) => `${NS}:failed:${email}`;
export const lockoutKey = (email) => `${NS}:lockout:${email}`;

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
export async function invalidateStorefrontCache(slug) {
  if (!slug) return;
  try {
    await withTimeout(redis.del(`store:cache:store:${slug}`));
  } catch (error) {
    // Self-heals via the store app's own TTL on that key -- not a new hole.
    console.warn('Storefront cache invalidation failed, skipping:', slug, error.message);
  }
}
