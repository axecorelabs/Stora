// Shared by apps/store/src/proxy.js and any Route Handler that needs to know
// which vendor subdomain a request actually came in on. workers/subdomain-router's
// Cloudflare Worker forwards <slug>.stora.com.ng requests to this app's own
// apex domain, preserving the real subdomain in X-Stora-Vendor-Host --
// deliberately NOT X-Forwarded-Host, which Vercel overwrites to match the
// actual connection (the Worker's own Host to Vercel, www.stora.com.ng)
// regardless of what an upstream proxy sets. See proxy.js's own history of
// this for the confirmed-live failure mode that led here.
//
// X-Stora-Vendor-Host is only ever trusted when X-Stora-Proxy-Secret matches
// STORA_PROXY_SECRET -- this app is a normal public origin, reachable
// directly, so an unverified header here would let anyone spoof which
// vendor's page (or, for a Route Handler, which vendor's OAuth session)
// renders under www.stora.com.ng.
const PROXY_SECRET = process.env.STORA_PROXY_SECRET || null;

export function isFromTrustedProxy(req) {
  if (!PROXY_SECRET) return false;
  return req.headers.get('x-stora-proxy-secret') === PROXY_SECRET;
}

// Returns the real host (no port) this request is actually for -- the
// verified vendor subdomain when the trusted Worker forwarded one, or the
// plain Host header otherwise (local dev, or a request hitting the apex/
// Vercel deployment directly).
export function resolveRequestHost(req) {
  const forwardedHost = isFromTrustedProxy(req) ? req.headers.get('x-stora-vendor-host') : null;
  return (forwardedHost || req.headers.get('host') || '').split(':')[0].toLowerCase();
}
