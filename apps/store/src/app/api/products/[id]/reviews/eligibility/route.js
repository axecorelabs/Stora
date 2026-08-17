import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getReviewEligibility } from "@/lib/supabaseReviews";

// GET - can the current customer review this product, and do they already
// have a review (so the page can render an edit form instead of a blank
// one)? Not authenticated isn't an error here -- it's a real, valid answer
// ("no, sign in first") the page needs to render around, not a 401.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      return NextResponse.json({ success: true, canReview: false, alreadyReviewed: false, existingReview: null });
    }

    const eligibility = await getReviewEligibility(customerId, id);
    return NextResponse.json({ success: true, ...eligibility });
  } catch (error) {
    console.error("Error checking review eligibility:", error);
    return NextResponse.json(
      { success: false, message: "Failed to check review eligibility" },
      { status: 500 }
    );
  }
}
