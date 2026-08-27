import { auth } from "@/lib/betterAuth";

// Better Auth's own default OAuth callback path convention
// (${baseURL}/api/auth/callback/google) -- this is the actual redirect_uri
// Google now sends the browser back to (see google/start/route.js's
// signInSocial call, which doesn't override it). This dashboard app's own
// Google Cloud Console OAuth client (a different client than the store
// app's) needs this exact URL added as an authorized redirect URI
// alongside the old one -- a manual step outside this codebase.
//
// callbackOAuth handles everything the old hand-rolled callback route
// used to do by hand: exchanging the code, verifying the id token,
// looking up by google_id then by email (auto-linking via
// account.accountLinking.trustedProviders: ['google'] in betterAuth.js),
// creating a new user (plus their trial subscription, via
// databaseHooks.user.create.after) if neither matches, setting the real
// session cookie, and redirecting -- this file is a thin pass-through,
// not a reimplementation.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  return auth.api.callbackOAuth({
    params: { id: "google" },
    query: Object.fromEntries(searchParams),
    headers: req.headers,
    asResponse: true
  });
}
