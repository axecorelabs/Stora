import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { insertAcceptanceRows, clearLegalReviewPending } from "@/lib/legalAcceptance";

// Backs the review-and-accept interstitial (/auth/review-and-accept) --
// the one place a vendor whose account was created with no consent step
// (Google OAuth sign-up) actually agrees to the Terms/Privacy Policy.
// Deliberately doesn't accept a documents list from the client: this route
// only ever records the standard signup pair, same as the checkbox on the
// email/password form does.
export async function POST(request) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    await insertAcceptanceRows({
      actorType: "vendor_user",
      actorId: user.id,
      documents: ["terms_of_service", "privacy_policy"],
      context: "oauth_first_login",
      request
    });

    await clearLegalReviewPending(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording legal acceptance:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't save your acceptance. Please try again." },
      { status: 500 }
    );
  }
}
