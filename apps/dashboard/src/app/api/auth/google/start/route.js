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
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/dashboard",
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
