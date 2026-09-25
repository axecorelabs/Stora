import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientIp } from "@/lib/legalAcceptance";
import { verifyTurnstileToken } from "@/lib/turnstile";

// Public, unauthenticated "report this listing" intake -- the safety net
// for the dashboard's unverified self-attach claim path (a listing with no
// contact info to verify a claimant against). Lets a real owner who shows
// up later dispute a bad-faith claim; staff review these in the admin app
// and can revoke the claim if upheld (see apps/admin's
// business-claim-disputes routes).
export async function POST(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const isHuman = await verifyTurnstileToken(body.turnstileToken, getClientIp(request));
  if (!isHuman) {
    return NextResponse.json(
      { success: false, message: "Verification failed. Please try again." },
      { status: 400 }
    );
  }

  const { id: storeId } = await params;

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id, claim_status")
    .eq("id", storeId)
    .single();

  if (storeError || !store) {
    return NextResponse.json({ success: false, message: "Listing not found" }, { status: 404 });
  }
  if (store.claim_status !== "claimed") {
    return NextResponse.json({ success: false, message: "This listing hasn't been claimed by anyone yet" }, { status: 400 });
  }

  const reporterName = typeof body.reporterName === "string" ? body.reporterName.trim() : "";
  const reporterEmail = typeof body.reporterEmail === "string" ? body.reporterEmail.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!reporterName || !reporterEmail || !details) {
    return NextResponse.json({ success: false, message: "Name, email, and details are required" }, { status: 400 });
  }

  const reporterPhone = typeof body.reporterPhone === "string" ? body.reporterPhone.trim() || null : null;
  const relationship = ["owner", "employee", "other"].includes(body.relationship) ? body.relationship : "owner";

  const { error } = await supabaseAdmin.from("business_claim_disputes").insert({
    store_id: storeId,
    reporter_name: reporterName,
    reporter_email: reporterEmail,
    reporter_phone: reporterPhone,
    relationship,
    details
  });

  if (error) {
    console.error("Error saving business claim dispute:", error);
    return NextResponse.json({ success: false, message: "Failed to submit report" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
