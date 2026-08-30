'use client';

// isVendorSubdomainHost lives in lib/apexDomain.js (no 'use client') so
// server code (Route Handlers) can call it too -- a 'use client' module's
// exports are client references at build time and can't be invoked from
// the server at all. Re-exported here so existing client call sites don't
// need to change their import path.
import { isVendorSubdomainHost } from './apexDomain';
export { isVendorSubdomainHost };

// window-reading wrapper -- every current call site only ever runs this
// from a click handler (router.push in an onClick), never during a
// server render, so `window` is always defined by the time it matters.
// Don't call this from render logic without checking that still holds.
export function isVendorSubdomain() {
  if (typeof window === 'undefined') return false;
  return isVendorSubdomainHost(window.location.hostname);
}

// Builds a path to somewhere within the CURRENT store -- /products,
// /product/123, /cart, etc. On a vendor subdomain, the hostname itself
// already scopes every request to this store (apps/store/src/proxy.js
// rewrites every path there to /<slug>/... server-side), so the path
// must NOT also carry the slug -- confirmed live: navigating to
// /dotun-s-store-697203/products while already on that vendor's own
// subdomain 404s, because the rewrite prepends the slug a second time.
// On path-based access (stora.com.ng/<slug>/...), the slug prefix is
// still required, exactly as before subdomains existed.
export function storeHref(storeSlug, path = '/') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (isVendorSubdomain()) return suffix;
  return `/${storeSlug}${suffix}`;
}
