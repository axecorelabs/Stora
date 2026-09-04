import { supabaseAdmin } from "@/lib/supabase";

// The date printed as "Last updated" on each page in /legal and
// apps/dashboard/src/app/(terms|privacy|vendor-agreement|vendor-kyc-policy) --
// bump this alongside the page copy whenever a document materially
// changes, so a future re-acceptance flow can query "accepted a version
// older than current" directly against this string. Mirrors the same
// constant in apps/store/src/lib/legalAcceptance.js -- kept as two copies
// rather than a shared package since each app owns its own page content
// and the two could legitimately drift (e.g. a Vendor Agreement update
// with no matching Terms of Service change).
export const LEGAL_DOCUMENT_VERSIONS = {
  terms_of_service: "2026-09-04",
  privacy_policy: "2026-09-04",
  vendor_agreement: "2026-09-04",
  vendor_kyc_policy: "2026-09-04"
};

// Same x-forwarded-for/x-real-ip fallback chain used elsewhere in this
// codebase for IP extraction (e.g. apps/store's proxy.js/analytics route).
export function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || null;
}

// Fire-and-forget by design: a logging failure must never block signup or
// KYC verification itself -- callers await this for ordering but errors
// are swallowed here, not propagated.
export async function recordLegalAcceptance({ actorType, actorId, documents, context, request }) {
  try {
    await insertAcceptanceRows({ actorType, actorId, documents, context, request });
  } catch (error) {
    console.error("Error recording legal acceptance (non-fatal):", error);
  }
}

// Opposite trust posture from recordLegalAcceptance above -- this backs
// the review-and-accept interstitial (/auth/review-and-accept), where
// logging acceptance IS the point of the request. Errors propagate so the
// route can tell the vendor to retry instead of silently clearing
// legal_review_pending_at on a request that never actually recorded
// anything.
export async function insertAcceptanceRows({ actorType, actorId, documents, context, request }) {
  const ip = request ? getClientIp(request) : null;
  const userAgent = request ? request.headers.get("user-agent") : null;
  const rows = documents.map((document) => ({
    actor_type: actorType,
    actor_id: actorId,
    document,
    document_version: LEGAL_DOCUMENT_VERSIONS[document] || "unknown",
    context,
    ip_address: ip,
    user_agent: userAgent
  }));
  const { error } = await supabaseAdmin.from("legal_acceptances").insert(rows);
  if (error) throw error;
}

// Clears the fail-safe flag databaseHooks.user.create.after (betterAuth.js)
// sets on every new vendor user -- called only once real consent has
// actually been recorded (signup/route.js right after its own
// recordLegalAcceptance call; the review-and-accept route after
// insertAcceptanceRows above succeeds). Throws on failure -- deliberately
// NOT swallowed, unlike recordLegalAcceptance: see the matching comment in
// apps/store/src/lib/legalAcceptance.js.
export async function clearLegalReviewPending(userId) {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ legal_review_pending_at: null })
    .eq("id", userId);
  if (error) throw error;
}
