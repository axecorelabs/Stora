import { supabaseAdmin } from './supabase';

// Reviews are gated on "did this customer actually receive this product,"
// which lives on orders.status, not order_items.item_status -- that
// column is a free-form string various routes write to
// (supabaseOrders.js's updateOrderItemStatus), never a maintained
// per-item "delivered" enum. orders.status === 'delivered' is the one
// value the order-fulfillment flow actually transitions to and treats as
// final (it's what triggers fulfillOrderReservations and sets
// delivered_at) -- so that's the real "this happened" signal, at the
// whole-order level, matching the API's "which order proves you bought
// this" model (order_id is stored on the review for traceability, but
// the eligibility check itself only needs product_id + customer_id).
async function findDeliveredOrderForProduct(customerId, productId) {
  const { data, error } = await supabaseAdmin
    .from('order_items')
    .select('order_id, store_id, orders!inner(id, customer_id, status, created_at)')
    .eq('product_id', productId)
    .eq('orders.customer_id', customerId)
    .eq('orders.status', 'delivered')
    .order('created_at', { referencedTable: 'orders', ascending: false })
    .limit(1);

  if (error) {
    console.error('Error checking delivered order for review eligibility:', error);
    throw new Error('Failed to check review eligibility');
  }

  const row = data?.[0];
  if (!row) return null;
  return { orderId: row.order_id, storeId: row.store_id };
}

// The caller's own review (from getReviewEligibility/upsertReview) never
// needs a reviewer name attached -- the UI already knows whose it is
// ("Your review"). Keeping this separate from transformPublicReview below
// avoids a fake placeholder name standing in for a join that was never
// requested on these code paths.
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
    // First name + last initial only -- enough for a review to feel like
    // a real person, nothing that identifies them.
    reviewerName: lastInitial ? `${firstName} ${lastInitial}.` : firstName,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Whether `customerId` can review `productId` right now, and their
// existing review if they already have one (so the UI can render an edit
// form pre-filled instead of a fresh one).
export async function getReviewEligibility(customerId, productId) {
  const { data: existing, error } = await supabaseAdmin
    .from('product_reviews')
    .select('id, rating, comment, created_at, updated_at')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching existing review:', error);
    throw new Error('Failed to check review eligibility');
  }

  if (existing) {
    return { canReview: true, alreadyReviewed: true, existingReview: transformOwnReview(existing) };
  }

  const delivered = await findDeliveredOrderForProduct(customerId, productId);
  return { canReview: !!delivered, alreadyReviewed: false, existingReview: null };
}

// Insert-or-edit in one call -- the UNIQUE(customer_id, product_id)
// constraint is the real enforcement; this just makes "submit again"
// behave as "edit" rather than erroring, which is the friendlier
// customer-facing shape (they don't need to know it's technically an
// upsert vs. a separate edit flow).
export async function upsertReview({ customerId, productId, rating, comment }) {
  const delivered = await findDeliveredOrderForProduct(customerId, productId);
  if (!delivered) {
    const err = new Error('Only customers with a delivered order for this product can review it');
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from('product_reviews')
    .upsert(
      {
        product_id: productId,
        store_id: delivered.storeId,
        customer_id: customerId,
        order_id: delivered.orderId,
        rating,
        comment: comment?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'customer_id,product_id' }
    )
    .select('id, rating, comment, created_at, updated_at')
    .single();

  if (error) {
    console.error('Error upserting review:', error);
    throw new Error('Failed to save review');
  }

  return transformOwnReview(data);
}

export async function deleteReview(reviewId, customerId) {
  // Soft delete, matching this schema's convention elsewhere
  // (inventory.is_deleted etc.) -- also what the aggregate trigger
  // actually watches (UPDATE OF is_active), not a hard DELETE.
  const { data, error } = await supabaseAdmin
    .from('product_reviews')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('customer_id', customerId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error deleting review:', error);
    throw new Error('Failed to delete review');
  }

  return !!data;
}

const REVIEWS_PAGE_SIZE = 10;

export async function findProductReviews(productId, { page = 1 } = {}) {
  const offset = (page - 1) * REVIEWS_PAGE_SIZE;

  const { data, error, count } = await supabaseAdmin
    .from('product_reviews')
    .select('id, rating, comment, created_at, updated_at, customers(first_name, last_name)', { count: 'exact' })
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + REVIEWS_PAGE_SIZE - 1);

  if (error) {
    console.error('Error fetching product reviews:', error);
    throw new Error('Failed to fetch reviews');
  }

  const total = count || 0;
  return {
    reviews: (data || []).map(transformPublicReview),
    pagination: {
      page,
      limit: REVIEWS_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
      hasMore: page * REVIEWS_PAGE_SIZE < total
    }
  };
}
