import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { isVendorSubdomainHost } from "@/lib/apexDomain";
import { resolveRequestHost } from "@/lib/vendorHost";

// Rejects absolute and protocol-relative URLs so a crafted returnTo can't
// redirect off-site (open redirect) -- store is multi-tenant/path-based
// ([slug]/...), so the post-login destination always travels as a path.
// Also rejects a backslash anywhere in the path: browsers normalize \ to /
// when resolving a URL, so "/\evil.com" parses the SAME as "//evil.com" once
// handed to a browser as a bare relative redirect target (confirmed against
// Better Auth's own isSafeRelativeURL check, which rejects backslashes for
// exactly this reason) -- and this route's apex-origin branch below does
// hand safeReturnTo to Better Auth completely bare, with no origin prefixed
// in front of it to pin the host first.
function isSafeReturnTo(path) {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('\\')
    && !/^\/[^/]*:/.test(path);
}

// Frontend still calls this exact path -- internally it now asks Better
// Auth for the Google consent-screen URL (it manages its own CSRF state
// cookie) instead of building one by hand via google-auth-library.
// signInSocial returns { url, redirect } as JSON, not a real HTTP
// redirect -- this route is what turns that into an actual 3xx response
// for a plain top-level navigation/link click to work.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo');
  const safeReturnTo = isSafeReturnTo(returnTo) ? returnTo : '/';

  // Google's redirect_uri is pinned to baseURL (see callback/google/route.js),
  // so the OAuth round-trip always lands on the apex host first, regardless
  // of which vendor subdomain this request actually came from. The plain
  // Host header is NOT enough to know that here -- in production this
  // request comes through workers/subdomain-router's Cloudflare Worker,
  // which always sets Host to www.stora.com.ng and carries the real vendor
  // subdomain in the verified X-Stora-Vendor-Host header instead (same
  // resolution proxy.js uses for its own page rewrite). Building an absolute
  // callbackURL back to that resolved host is safe since it only ever comes
  // from our own trusted Worker or the request's own Host, never from
  // caller-supplied input -- otherwise the customer would finish signing in
  // on the apex and never return to the store they started on.
  const host = resolveRequestHost(req);
  const onVendorSubdomain = isVendorSubdomainHost(host);
  const origin = onVendorSubdomain ? `https://${host}` : '';
  const callbackURL = `${origin}${safeReturnTo}`;

  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL,
      errorCallbackURL: `${origin}/?authError=google_failed`
    },
    asResponse: true
  });

  const data = await result.json();
  if (!data.url) {
    return NextResponse.redirect(origin ? `${origin}/?authError=google_failed` : new URL("/?authError=google_failed", req.url));
  }

  const response = NextResponse.redirect(data.url);
  const setCookie = result.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
