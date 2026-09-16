import { NextResponse } from 'next/server';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { getListingReviewEligibility } from '@/lib/supabaseListingReviews';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      return NextResponse.json({
        success: true,
        canReview: false,
        alreadyReviewed: false,
        existingReview: null
      });
    }

    const eligibility = await getListingReviewEligibility(customerId, id);
    return NextResponse.json({ success: true, ...eligibility });
  } catch (error) {
    console.error('Error checking listing review eligibility:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check review eligibility' },
      { status: 500 }
    );
  }
}