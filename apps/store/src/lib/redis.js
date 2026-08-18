import { Redis } from '@upstash/redis';
import { after } from 'next/server';

export const redis = Redis.fromEnv();

// Both apps share one physical Redis database -- every key must be
// namespaced per app to avoid collisions.
export const NS = 'store';

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

// --- Read-path (cache-aside) caching --------------------------------------
//
// For public, browse-oriented data that's read on every pageview/reload but
// only ever written by a handful of known mutation points (a vendor editing
// their store, adding a product, a customer liking an item). Same fail-open
// contract as everything else in this file: a Redis miss/error always falls
// back to Postgres rather than blocking or erroring the request.
//
// Two invalidation strategies are used deliberately, not interchangeably:
//   - TTL-only, for data with no single well-known write path worth wiring
//     up cross-app (storefront/catalog browsing -- see cacheKey below).
//     Short-lived staleness (1-5 min) here is the same tradeoff every
//     e-commerce search/browse surface makes; it's not "wrong caching," it's
//     the appropriate one for this data.
//   - TTL + explicit invalidation, for data with one clear owner in this
//     app (the wishlist) where the mutation is cheap to hook and stale reads
//     are a visible correctness bug (an item shown as liked when it isn't).
export async function cacheGet(key) {
  try {
    return await withTimeout(redis.get(key));
  } catch (error) {
    console.warn('Cache read failed, falling back to source:', key, error.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  try {
    await withTimeout(redis.set(key, value, { ex: ttlSeconds }));
  } catch (error) {
    console.warn('Cache write failed, skipping:', key, error.message);
  }
}

export async function cacheDel(...keys) {
  if (keys.length === 0) return;
  try {
    await withTimeout(redis.del(...keys));
  } catch (error) {
    // Self-heals via each entry's own TTL -- not a new hole.
    console.warn('Cache invalidation failed, skipping:', keys, error.message);
  }
}

// Cache-aside in one call: serve a hit, else run `fetcher`, populate, and
// return the fresh value. `fetcher` always runs on a miss OR a cache error,
// so a Redis outage degrades to "every request hits Postgres," never to
// "requests fail."
export async function cached(key, ttlSeconds, fetcher) {
  const hit = await cacheGet(key);
  if (hit !== null && hit !== undefined) return hit;

  const fresh = await fetcher();
  // Deferred via `after()`, not just left un-awaited -- this runs as a
  // serverless function on Vercel, and a bare fire-and-forget promise can
  // be killed mid-flight once the response is sent, since the platform is
  // free to freeze the execution context right after that. `after()` is
  // the supported way to guarantee background work actually completes
  // (same pattern already used for post-response work in the auth routes
  // and orderNotifications.js) -- the caller still doesn't wait for it,
  // but it's no longer a coin flip whether it finishes.
  after(() => cacheSet(key, fresh, ttlSeconds));
  return fresh;
}

export const cacheKey = {
  // TTL-only -- see comment above.
  storeBySlug: (slug) => `${NS}:cache:store:${slug}`,
  featuredStores: (limit) => `${NS}:cache:featured:${limit}`,
  discover: (category, search, sort, limit) =>
    `${NS}:cache:discover:${category || '_'}:${search || '_'}:${sort}:${limit}`,
  // The /products search page's default landing view (no query, no
  // category, page 1) -- the overwhelming majority of visits to that page,
  // unlike free-text search itself which is too varied to cache usefully.
  productsSearchDefault: (sort) => `${NS}:cache:products-search-default:${sort}`,
  // The typeahead's own preview endpoint has a much narrower key space than
  // full search (just `q`, no category/price/sort/page), and short/common
  // prefixes get typed identically by many different people -- unlike full
  // search results, this one has a real, exploitable hit rate. Lowercased
  // since the underlying ILIKE match is already case-insensitive.
  searchPreview: (q) => `${NS}:cache:search-preview:${q.toLowerCase()}`,
  // TTL + explicit invalidation on add/remove -- see comment above.
  wishlist: (customerId) => `${NS}:cache:wishlist:${customerId}`,
};

// Backstop only -- every wishlist mutation route writes the fresh result
// straight back into the cache, so this TTL is just how long a stale entry
// could theoretically survive a missed invalidation path, not the normal
// refresh mechanism.
export const WISHLIST_CACHE_TTL_SECONDS = 300;
