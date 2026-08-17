import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { findProductReviews, upsertReview } from "@/lib/supabaseReviews";

// GET - public, paginated list of a product's reviews
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const result = await findProductReviews(id, { page });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST - submit or edit the caller's own review for this product. Eligibility
// (a delivered order containing this product) is re-verified server-side
// inside upsertReview -- never trust a client-supplied "I bought this".
export async function POST(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const rating = Number(body.rating);
    const comment = typeof body.comment === "string" ? body.comment : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be a whole number from 1 to 5" },
        { status: 400 }
      );
    }

    if (comment.length > 2000) {
      return NextResponse.json(
        { success: false, message: "Review is too long (2000 characters max)" },
        { status: 400 }
      );
    }

    const review = await upsertReview({ customerId, productId: id, rating, comment });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    if (error.code === "NOT_ELIGIBLE") {
      return NextResponse.json(
        { success: false, message: "Only customers who've received this product can review it" },
        { status: 403 }
      );
    }
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save review" },
      { status: 500 }
    );
  }
}
