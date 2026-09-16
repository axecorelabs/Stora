import { NextResponse } from 'next/server';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { findListingProfileReviews, upsertListingReview } from '@/lib/supabaseListingReviews';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get('page'), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const result = await findListingProfileReviews(id, { page });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, message: 'Listing not found' },
        { status: 404 }
      );
    }

    console.error('Error fetching listing reviews:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const rating = Number(body.rating);
    const comment = typeof body.comment === 'string' ? body.comment : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: 'Rating must be a whole number from 1 to 5' },
        { status: 400 }
      );
    }

    if (comment.length > 2000) {
      return NextResponse.json(
        { success: false, message: 'Review is too long (2000 characters max)' },
        { status: 400 }
      );
    }

    const review = await upsertListingReview({
      customerId,
      storeId: id,
      rating,
      comment
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, message: 'Listing not found' },
        { status: 404 }
      );
    }

    console.error('Error saving listing review:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save review' },
      { status: 500 }
    );
  }
}