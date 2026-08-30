// Vendor subdomain router
//
// Cloudflare Route: *.stora.com.ng/*  (zone stays on Cloudflare -- no
// nameserver handoff to Vercel, which wildcard TLS would otherwise require;
// see the wrangler.toml comment for why).
//
// A request to <slug>.stora.com.ng is forwarded to the store app's own
// verified Vercel domain (STORE_ORIGIN_HOST), with the original hostname
// preserved in X-Forwarded-Host -- apps/store's middleware reads that
// header to decide which vendor's /[slug] routes to rewrite to. This
// Worker never parses store slugs against a database; it only extracts
// the subdomain label and does light shape validation before forwarding,
// same as any reverse proxy would.
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

    // Reserved (app, www, ...) or the bare apex somehow matching this
    // route -- these have their own DNS records in the zone already, so
    // let the request through exactly as it arrived rather than
    // rewriting it at the store app.
    if (label === '' || isReserved(label, reserved)) {
      return fetch(request);
    }

    // Multi-level subdomains (foo.bar.stora.com.ng) and anything that
    // doesn't look like a real slug label never map to a store -- fail
    // fast instead of forwarding garbage to the origin.
    if (label.includes('.') || !VALID_LABEL.test(label)) {
      return new Response('Not found', { status: 404 });
    }

    const originUrl = new URL(url.pathname + url.search, `https://${env.STORE_ORIGIN_HOST}`);

    const originRequest = new Request(originUrl, request);
    // Constructing from `request` carries its Host header along
    // (<slug>.stora.com.ng) -- Vercel routes incoming requests by Host, so
    // left as-is this would hit no project at all. Overwriting it to the
    // store app's own verified domain is what actually gets it there; the
    // original hostname travels in X-Forwarded-Host instead, for the store
    // app's middleware to recover the slug from.
    originRequest.headers.set('Host', env.STORE_ORIGIN_HOST);
    originRequest.headers.set('X-Forwarded-Host', url.hostname);
    originRequest.headers.set('X-Forwarded-Proto', 'https');

    return fetch(originRequest);
  },
};
