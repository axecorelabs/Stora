import { supabaseAdmin } from './supabase';

const REVIEWS_PAGE_SIZE = 8;

function transformOwnReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function transformPublicReview(row) {
  const firstName = row.customers?.first_name || 'A Stora customer';
  const lastInitial = row.customers?.last_name?.trim()?.charAt(0);

  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    reviewerName: lastInitial ? `${firstName} ${lastInitial}.` : firstName,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findActiveListingStore(storeId) {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('id, platform_mode, is_active, subscription_status, average_rating, total_reviews')
    .eq('id', storeId)
    .maybeSingle();

  if (error) {
    console.error('Error loading listing store for reviews:', error);
    throw new Error('Failed to check listing store');
  }

  if (!data) return null;
  if (data.platform_mode !== 'listing') return null;
  if (!data.is_active) return null;
  if (data.subscription_status !== 'active') return null;

  return data;
}

export async function getListingReviewEligibility(customerId, storeId) {
  const store = await findActiveListingStore(storeId);
  if (!store) {
    return { canReview: false, alreadyReviewed: false, existingReview: null };
  }

  const { data: existing, error } = await supabaseAdmin
    .from('listing_profile_reviews')
    .select('id, rating, comment, created_at, updated_at')
    .eq('store_id', storeId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching existing listing review:', error);
    throw new Error('Failed to check review eligibility');
  }

  if (existing) {
    return { canReview: true, alreadyReviewed: true, existingReview: transformOwnReview(existing) };
  }

  return { canReview: true, alreadyReviewed: false, existingReview: null };
}

export async function upsertListingReview({ customerId, storeId, rating, comment }) {
  const store = await findActiveListingStore(storeId);
  if (!store) {
    const err = new Error('Listing store not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from('listing_profile_reviews')
    .upsert(
      {
        store_id: storeId,
        customer_id: customerId,
        rating,
        comment: comment?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'customer_id,store_id' }
    )
    .select('id, rating, comment, created_at, updated_at')
    .single();

  if (error) {
    console.error('Error upserting listing review:', error);
    throw new Error('Failed to save review');
  }

  return transformOwnReview(data);
}

export async function deleteListingReview(reviewId, customerId) {
  const { data, error } = await supabaseAdmin
    .from('listing_profile_reviews')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('customer_id', customerId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error deleting listing review:', error);
    throw new Error('Failed to delete review');
  }

  return !!data;
}

export async function findListingProfileReviews(storeId, { page = 1 } = {}) {
  const store = await findActiveListingStore(storeId);
  if (!store) {
    const err = new Error('Listing store not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const offset = (page - 1) * REVIEWS_PAGE_SIZE;

  const { data, error, count } = await supabaseAdmin
    .from('listing_profile_reviews')
    .select('id, rating, comment, created_at, updated_at, customers(first_name, last_name)', { count: 'exact' })
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + REVIEWS_PAGE_SIZE - 1);

  if (error) {
    console.error('Error fetching listing profile reviews:', error);
    throw new Error('Failed to fetch reviews');
  }

  const total = count || 0;
  return {
    reviews: (data || []).map(transformPublicReview),
    summary: {
      averageRating: Number(store.average_rating || 0),
      totalReviews: Number(store.total_reviews || 0)
    },
    pagination: {
      page,
      limit: REVIEWS_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
      hasMore: page * REVIEWS_PAGE_SIZE < total
    }
  };
}