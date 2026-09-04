import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";

// Frontend still calls this exact path -- internally it now asks Better
// Auth for the Google consent-screen URL (it manages its own CSRF state
// cookie) instead of building one by hand via google-auth-library.
// signInSocial returns { url, redirect } as JSON, not a real HTTP
// redirect -- this route turns that into an actual 3xx response for a
// plain top-level navigation/link click to work. Always lands on
// /dashboard on success, matching the old callback route's hardcoded
// destination (this app never supported a returnTo param).
export async function GET(req) {
  // Better Auth's own new-vs-existing-user distinction (isRegister, set
  // when this call actually inserts a new users row rather than linking
  // an existing one by matching provider/email) -- a brand-new Google
  // signup lands on the review-and-accept interstitial instead of
  // /dashboard directly; an existing vendor's Google sign-in doesn't.
  // databaseHooks.user.create.after (betterAuth.js) flags every new row
  // as legal_review_pending_at; this is the one place that can clear it
  // for an account that had no checkbox to log consent from in the first
  // place. /dashboard/onboarding (a separate, pre-existing gate) still
  // runs after this one, via DashboardLayout's own redirect.
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/dashboard",
      newUserCallbackURL: "/auth/review-and-accept",
      errorCallbackURL: "/?error=google_failed"
    },
    asResponse: true
  });

  const data = await result.json();
  if (!data.url) {
    return NextResponse.redirect(new URL("/?error=google_failed", req.url));
  }

  const response = NextResponse.redirect(data.url);
  const setCookie = result.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
