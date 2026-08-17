import { redis, NS, withTimeout } from './redis';

// Real pageview counting never touches Postgres on the hot path -- see
// 20260818000001_visitor_analytics.sql's comment for why a per-visitor
// DB write is exactly what melts a DB at scale. Every real pageview does
// one Redis INCR (sub-millisecond, no DB round trip); a periodic Vercel
// Cron job (apps/store/src/app/api/analytics/flush/route.js) batches the
// day's counters into one Postgres upsert per store/product instead of
// one write per visitor.
//
// Store views and product views are deliberately independent counters,
// not nested -- a product-page visit doesn't also bump the store's own
// count, so "store views" always means "visits to this store's storefront
// page" specifically, not "any page belonging to this store."
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export const analyticsKey = {
  storeViews: (storeId, date) => `${NS}:analytics:views:store:${storeId}:${date}`,
  productViews: (productId, date) => `${NS}:analytics:views:product:${productId}:${date}`,
  // Short-lived per-(ip,target) throttle so one visitor's tab/refresh spam
  // can't inflate a single day's counter by much -- cheap, not airtight
  // (client-side analytics beacons never are), just enough to blunt
  // accidental or casual abuse without adding real infrastructure.
  throttle: (ip, kind, id) => `${NS}:analytics:throttle:${kind}:${id}:${ip}`,
};

const THROTTLE_SECONDS = 5;

// Returns true if this (ip, kind, id) combination already recorded a view
// within the last THROTTLE_SECONDS -- caller should skip the INCR if so.
// Fails open (never throttles) on a Redis error, matching every other
// helper in lib/redis.js.
export async function isThrottled(ip, kind, id) {
  if (!ip || !id) return false;
  try {
    const key = analyticsKey.throttle(ip, kind, id);
    // Upstash's SET NX returns "OK" when the key was set (not previously
    // throttled) and null when it already existed (still within the
    // throttle window).
    const set = await withTimeout(redis.set(key, '1', { nx: true, ex: THROTTLE_SECONDS }));
    return set === null;
  } catch (error) {
    console.warn('View throttle check failed, not throttling:', error.message);
    return false;
  }
}

export async function recordStoreView(storeId) {
  if (!storeId) return;
  try {
    await withTimeout(redis.incr(analyticsKey.storeViews(storeId, todayKey())));
  } catch (error) {
    console.warn('Failed to record store view:', error.message);
  }
}

export async function recordProductView(productId) {
  if (!productId) return;
  try {
    await withTimeout(redis.incr(analyticsKey.productViews(productId, todayKey())));
  } catch (error) {
    console.warn('Failed to record product view:', error.message);
  }
}
