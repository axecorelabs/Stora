import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientIp } from "@/lib/legalAcceptance";
import { verifyTurnstileToken } from "@/lib/turnstile";

// Public, unauthenticated intake for "is your favorite business not on
// Stora yet?" submissions. Deliberately never inserted into `stores`
// directly -- this is raw, unstructured input from an anonymous visitor,
// not a validated business record. Staff review these in the admin app
// and normalize them into a real unclaimed listing via
// POST /api/stores (apps/admin) once confirmed.
export async function POST(request) {
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

  const suggestedName = typeof body.suggestedName === "string" ? body.suggestedName.trim() : "";
  if (!suggestedName) {
    return NextResponse.json({ success: false, message: "Business name is required" }, { status: 400 });
  }

  const suggestedCategoryText = typeof body.suggestedCategoryText === "string" ? body.suggestedCategoryText.trim() || null : null;
  const suggestedLocationText = typeof body.suggestedLocationText === "string" ? body.suggestedLocationText.trim() || null : null;
  const submitterContact = typeof body.submitterContact === "string" ? body.submitterContact.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const { error } = await supabaseAdmin.from("business_suggestions").insert({
    suggested_name: suggestedName,
    suggested_category_text: suggestedCategoryText,
    suggested_location_text: suggestedLocationText,
    submitter_contact: submitterContact,
    notes
  });

  if (error) {
    console.error("Error saving business suggestion:", error);
    return NextResponse.json({ success: false, message: "Failed to submit suggestion" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
