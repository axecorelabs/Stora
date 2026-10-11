// Manual stale-while-revalidate over the Workers Cache API (caches.default
// has no SWR built in). Scoped PER COLO, not global -- during a viral
// spike across 100k-200k concurrent viewers, the number of simultaneous
// D1 hits on a TTL expiry is bounded by how many colos are actively
// serving traffic at that moment (tens to low hundreds), not by viewer
// count, since each colo independently caches its own copy. Combined with
// the background-refresh pattern below, D1 only ever sees one query per
// active colo per refresh cycle -- nowhere near a problem for a small
// indexed SELECT.
const FETCHED_AT_HEADER = 'X-Fetched-At';

function ageSeconds(response) {
  const fetchedAt = Number(response.headers.get(FETCHED_AT_HEADER) || 0);
  if (!fetchedAt) return Infinity;
  return (Date.now() - fetchedAt) / 1000;
}

function withFetchedAt(response) {
  const headers = new Headers(response.headers);
  headers.set(FETCHED_AT_HEADER, String(Date.now()));
  return new Response(response.body, { status: response.status, headers });
}

// cacheKeyUrl: a fixed, query-string-free URL identifying this cache entry
// (e.g. "https://lagoslife.stora.com.ng/__cache/leaderboard") -- every
// viewer shares the same entry per colo, since the leaderboard/page content
// doesn't vary per request.
// computeFresh: async () => Response. Only called on a true miss (never
// cached before, or past staleTtl with no usable stale copy) or from the
// background refresh.
export async function readThroughCache(ctx, cacheKeyUrl, { freshTtl, staleTtl }, computeFresh) {
  const cache = caches.default;
  const cacheKey = new Request(cacheKeyUrl);

  const cached = await cache.match(cacheKey);
  if (cached) {
    const age = ageSeconds(cached);
    if (age < freshTtl) {
      return cached;
    }
    if (age < staleTtl) {
      // Serve stale immediately; refresh in the background for the NEXT
      // request. This is what prevents a thundering herd on expiry -- the
      // viewer currently being served never waits on D1 at all.
      ctx.waitUntil(refreshAndStore(cache, cacheKey, computeFresh));
      return cached;
    }
  }

  // True miss, or stale past the safety-net window (background refresh
  // itself has been failing) -- block and compute synchronously.
  const fresh = await computeFresh();
  const stored = withFetchedAt(fresh.clone());
  ctx.waitUntil(cache.put(cacheKey, stored));
  return fresh;
}

async function refreshAndStore(cache, cacheKey, computeFresh) {
  try {
    const fresh = await computeFresh();
    await cache.put(cacheKey, withFetchedAt(fresh));
  } catch (error) {
    console.error('Background leaderboard cache refresh failed:', error);
  }
}
