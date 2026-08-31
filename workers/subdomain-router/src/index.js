// Vendor subdomain router
//
// Cloudflare Route: *.stora.com.ng/*  (zone stays on Cloudflare -- no
// nameserver handoff to Vercel, which wildcard TLS would otherwise require;
// see the wrangler.toml comment for why).
//
// A request to <slug>.stora.com.ng is forwarded to the store app's own
// verified Vercel domain (STORE_ORIGIN_HOST), with the original hostname
// preserved in X-Stora-Vendor-Host -- apps/store's proxy.js reads that
// header to decide which vendor's /[slug] routes to rewrite to.
//
// NOT X-Forwarded-Host: Vercel's own platform documents that header as
// "identical to the host header" -- it overwrites whatever an upstream
// proxy sets to match the actual connection's Host, discarding the real
// subdomain before the app ever sees it. Confirmed live: every vendor
// subdomain rendered the plain homepage instead of that vendor's store
// until this moved to a custom header name Vercel has no reason to touch.
//
// This Worker never parses store slugs against a database; it only
// extracts the subdomain label and does light shape validation before
// forwarding, same as any reverse proxy would.
//
// A handful of subdomains are reserved (the dashboard at app.stora.com.ng,
// www, etc.) -- those already have their own DNS records in this zone, so
// they're passed straight through unmodified rather than redirected at
// the store app.

// DNS labels: 1-63 chars, lowercase letters/digits, hyphens not at either
// end. Store slugs are generated as lowercase-hyphenated strings (see
// apps/dashboard's slug generation), so this should always match a real
// one -- it's a shape check against a malformed/hostile Host header, not
// a lookup against real store data (the store app's own middleware and
// [slug] route already 404 on a slug that doesn't exist).
const VALID_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isReserved(label, reservedSet) {
  return reservedSet.has(label);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const zoneSuffix = `.${env.ZONE_APEX}`;

    // Bare apex (stora.com.ng, no subdomain) canonicalizes to www, same as
    // it always has -- but answered directly at the edge now instead of
    // round-tripping to Vercel just to bounce the identical redirect back.
    // That round trip (a full TLS handshake + origin invocation) bought
    // nothing: the response body is empty either way, just a Location
    // header. Requires its own entry in wrangler.toml's `routes` array --
    // *.stora.com.ng/* alone never matches a zero-subdomain host, so
    // without it this branch would never run and apex traffic wouldn't
    // reach this Worker at all. The equivalent redirect at Vercel
    // (STORE_ORIGIN_HOST's own comment explains why it must stay www, not
    // apex) is left in place as a fallback for anything that reaches the
    // origin directly -- costs nothing to keep, and covers any path that
    // somehow bypasses this Worker.
    if (url.hostname === env.ZONE_APEX) {
      // Deliberately NOT `new URL(url.pathname + url.search, base)` -- the
      // constructor treats a relative reference starting with `//` as
      // protocol-relative, replacing base's AUTHORITY with whatever comes
      // after those slashes. A request to stora.com.ng//evil.com/x (a
      // literal, requestable path -- confirmed live) would then resolve
      // to https://evil.com/x, turning this into an open redirect off a
      // trusted domain. Setting `.pathname`/`.search` on an already-
      // constructed URL re-parses them strictly as path/query components
      // instead, so the same input safely becomes
      // https://www.stora.com.ng//evil.com/x -- confirmed via the same
      // test. This is the identical class of bug already found and fixed
      // in isSafeReturnTo/isSafeReturnPath elsewhere in apps/store.
      const target = new URL(`https://www.${env.ZONE_APEX}`);
      target.pathname = url.pathname;
      target.search = url.search;
      return Response.redirect(target.toString(), 308);
    }

    // Anything not actually under the zone apex (e.g. the worker's own
    // *.workers.dev testing URL) -- nothing sensible to route, so just
    // say so rather than silently guessing.
    if (!url.hostname.endsWith(zoneSuffix)) {
      return new Response('Unknown host', { status: 404 });
    }

    const label = url.hostname.slice(0, -zoneSuffix.length);
    const reserved = new Set(
      (env.RESERVED_SUBDOMAINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    // Of the reserved labels, the ones that are actually the marketplace
    // site itself (www) rather than some other reserved service (the
    // dashboard at app, R2 at storage/cdn, ...) -- see wrangler.toml's own
    // comment on this var for why only these get rate-limited here. The
    // bare apex doesn't appear here at all any more -- it's answered above
    // before label is even computed.
    const marketplaceLabels = new Set(
      (env.MARKETPLACE_SUBDOMAINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const isMarketplace = marketplaceLabels.has(label);

    // Reserved-but-not-marketplace (app, api, mail, ...) -- these have
    // their own DNS records in the zone already, so let the request
    // through exactly as it arrived, with no rate limiting applied here:
    // they're not marketplace browsing traffic, and each already has
    // whatever protection it needs on its own side.
    if (!isMarketplace && isReserved(label, reserved)) {
      return fetch(request);
    }

    // Multi-level subdomains (foo.bar.stora.com.ng) and anything that
    // doesn't look like a real slug label never map to a store -- fail
    // fast instead of forwarding garbage to the origin. Never reached for
    // the marketplace host (www, handled below) -- 'www' passes VALID_LABEL
    // anyway, but this guard only ever applies to a real vendor slug.
    if (!isMarketplace && (label.includes('.') || !VALID_LABEL.test(label))) {
      return new Response('Not found', { status: 404 });
    }

    // General browse-traffic rate limiting, moved here from
    // apps/store/src/proxy.js's own Redis-backed browseLimiter -- this is
    // the ONE limiter that fires on close to every request (every page
    // load and every Next.js <Link> prefetch), so it's the dominant
    // consumer of both Redis command quota and Vercel invocations. A
    // request rejected here never costs either. Applies to marketplace
    // traffic (www) exactly the same as a vendor slug -- same shared
    // bucket, same key (client IP), since it's the identical kind of
    // traffic just not rewritten to a per-vendor path (the bare apex never
    // reaches this point at all -- see the redirect above). The per-route
    // limiters for login/register/payments/etc. deliberately stay on
    // Redis: they're already low-volume by design, and several use
    // windows longer than 60s, which this binding can't represent
    // (period must be 10 or 60). 180/60s approximates the Redis version's
    // 3-per-second refill / 150 burst -- not the same token-bucket shape,
    // but the same "only ever trips for actual abuse, never a real
    // shopper" intent.
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const { success } = await env.BROWSE_RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return new Response(
          JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
    } catch (error) {
      // Fail open, same convention as apps/store/src/proxy.js's own
      // Redis-backed limiters: this binding now fires on every request to
      // the entire zone (marketplace + every vendor slug), so a thrown
      // error here -- a misconfigured namespace_id, the binding not yet
      // provisioned, a transient platform issue -- must never turn into a
      // site-wide outage. Worst case on a limiter failure is the same as
      // today: unrestricted traffic through to the origin, not a 500.
      console.error('Worker rate limit check failed, allowing request:', error);
    }

    if (isMarketplace) {
      // www already has its own DNS record pointing straight at this
      // Vercel project -- unlike a vendor slug, there's no rewrite to do
      // and no Host header to fix, just proof that this request already
      // got rate-limited here so proxy.js's own browseLimiter can skip
      // its now-redundant Redis check.
      const marketplaceRequest = new Request(request);
      marketplaceRequest.headers.set('X-Stora-Proxy-Secret', env.PROXY_SECRET || '');
      marketplaceRequest.headers.set('X-Stora-Worker-Ratelimited', '1');
      return fetch(marketplaceRequest);
    }

    // Deliberately NOT `new URL(url.pathname + url.search, base)` -- see
    // the identical comment on the apex redirect above. Here the stakes
    // are higher than a redirect: `url.pathname` starting with `//` would
    // make THIS WORKER itself fetch() an attacker-controlled origin (SSRF)
    // and return that response as if it were the vendor's page, forwarding
    // along every header the browser sent -- including any
    // `.stora.com.ng`-scoped session cookie (see betterAuth.js's
    // crossSubDomainCookies), which would then leak directly to that
    // origin. Confirmed live: some-vendor.stora.com.ng//evil.com/x
    // resolved to https://evil.com/x before this fix. Setting
    // `.pathname`/`.search` on an already-constructed URL avoids the
    // protocol-relative reinterpretation entirely.
    const originUrl = new URL(`https://${env.STORE_ORIGIN_HOST}`);
    originUrl.pathname = url.pathname;
    originUrl.search = url.search;

    const originRequest = new Request(originUrl, request);
    // Constructing from `request` carries its Host header along
    // (<slug>.stora.com.ng) -- Vercel routes incoming requests by Host, so
    // left as-is this would hit no project at all. Overwriting it to the
    // store app's own verified domain is what actually gets it there.
    originRequest.headers.set('Host', env.STORE_ORIGIN_HOST);
    // The real subdomain, in a header name Vercel has no built-in opinion
    // about (see the file-level comment on why this isn't X-Forwarded-Host).
    originRequest.headers.set('X-Stora-Vendor-Host', url.hostname);
    // Proves this request actually came through this Worker -- the store
    // app is a normal public origin, reachable directly (its own domain,
    // or the underlying *.vercel.app URL), so without this anyone could
    // set X-Stora-Vendor-Host themselves and make the app render an
    // arbitrary vendor's page under www.stora.com.ng. Set via
    // `wrangler secret put PROXY_SECRET` (never in wrangler.toml's [vars]
    // -- that file is committed to git in plaintext), matched against
    // STORA_PROXY_SECRET in the Vercel project's environment variables.
    originRequest.headers.set('X-Stora-Proxy-Secret', env.PROXY_SECRET || '');
    originRequest.headers.set('X-Stora-Worker-Ratelimited', '1');
    originRequest.headers.set('X-Forwarded-Proto', 'https');

    return fetch(originRequest);
  },
};
