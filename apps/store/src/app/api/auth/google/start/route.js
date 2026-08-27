import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";

// Rejects absolute and protocol-relative URLs so a crafted returnTo can't
// redirect off-site (open redirect) -- store is multi-tenant/path-based
// ([slug]/...), so the post-login destination always travels as a path.
// Same check the old apps/store/src/lib/googleAuth.js used to export.
function isSafeReturnTo(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !/^\/[^/]*:/.test(path);
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

  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: safeReturnTo,
      errorCallbackURL: "/?authError=google_failed"
    },
    asResponse: true
  });

  const data = await result.json();
  if (!data.url) {
    return NextResponse.redirect(new URL("/?authError=google_failed", req.url));
  }

  const response = NextResponse.redirect(data.url);
  const setCookie = result.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
