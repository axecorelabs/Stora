import { NextResponse } from 'next/server';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { deleteListingReview } from '@/lib/supabaseListingReviews';

export async function DELETE(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const deleted = await deleteListingReview(id, customerId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting listing review:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete review' },
      { status: 500 }
    );
  }
}