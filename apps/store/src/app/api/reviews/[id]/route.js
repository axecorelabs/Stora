import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { deleteReview } from "@/lib/supabaseReviews";

// DELETE - a customer removing their own review. deleteReview scopes the
// update to customer_id = caller, so this can't be used to delete anyone
// else's review by guessing an id.
export async function DELETE(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const deleted = await deleteReview(id, customerId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting review:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete review" },
      { status: 500 }
    );
  }
}
