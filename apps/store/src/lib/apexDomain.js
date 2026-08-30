// Plain module, deliberately with NO 'use client'/'use server' directive --
// this exact hostname check is needed from both client components
// (lib/storeUrl.js) and Route Handlers (lib/vendorHost.js, google/start,
// payments/initiate). A 'use client'-tagged module's exports become client
// references at build time and can't be called from server code at all
// (confirmed live: "Attempted to call isVendorSubdomainHost() from the
// server but isVendorSubdomainHost is on the client" 500ing both the Google
// OAuth start route and the Paystack initiate route), so this pure check
// has to live somewhere with no directive at all.
const APEX_DOMAIN = process.env.NEXT_PUBLIC_STORE_APEX_DOMAIN || 'stora.com.ng';

// True when `hostname` is a real vendor subdomain (<slug>.stora.com.ng),
// not the apex/www marketplace host (or localhost in dev).
export function isVendorSubdomainHost(hostname) {
  if (!hostname) return false;
  const host = hostname.split(':')[0].toLowerCase();
  if (host === APEX_DOMAIN || host === `www.${APEX_DOMAIN}`) return false;
  return host.endsWith(`.${APEX_DOMAIN}`);
}

export { APEX_DOMAIN };
