import { supabaseAdmin } from "@/lib/supabase";

// The date printed as "Last updated" on each page in /legal and
// apps/store/src/app/(terms|privacy|refund-policy|delivery-policy) --
// bump this alongside the page copy whenever a document materially
// changes, so a future re-acceptance flow can query "accepted a version
// older than current" directly against this string.
export const LEGAL_DOCUMENT_VERSIONS = {
  terms_of_service: "2026-09-04",
  privacy_policy: "2026-09-04"
};

// Same x-forwarded-for/x-real-ip fallback chain already used for view
// throttling (apps/store/src/app/api/analytics/view/route.js) -- kept as
// its own helper here since acceptance logging needs it from several
// route handlers, not just one.
export function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || null;
}

// Fire-and-forget by design: a logging failure must never block signup
// itself (a customer who can't create an account because an audit-log
// insert failed is a much worse outcome than one missing log row) --
// callers await this for ordering but errors are swallowed here, not
// propagated.
export async function recordLegalAcceptance({ actorType, actorId, documents, context, request }) {
  try {
    await insertAcceptanceRows({ actorType, actorId, documents, context, request });
  } catch (error) {
    console.error("Error recording legal acceptance (non-fatal):", error);
  }
}

// Opposite trust posture from recordLegalAcceptance above -- this backs
// the review-and-accept interstitial (/auth/review-and-accept), where
// logging acceptance IS the point of the request, not an incidental side
// effect of something else succeeding. Errors propagate so the route can
// tell the customer to retry instead of silently clearing
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
// sets on every new customer -- called only once real consent has actually
// been recorded (register/route.js right after its own
// recordLegalAcceptance call; the review-and-accept route after
// insertAcceptanceRows above succeeds). Throws on failure -- deliberately
// NOT swallowed here, unlike recordLegalAcceptance: the review-and-accept
// route needs to know if this failed so it can tell the customer to retry,
// rather than reporting success while leaving them stuck in a redirect
// loop back to the same interstitial. Callers for whom this is incidental
// (register/route.js) wrap it in their own try/catch instead.
export async function clearLegalReviewPending(customerId) {
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ legal_review_pending_at: null })
    .eq("id", customerId);
  if (error) throw error;
}
