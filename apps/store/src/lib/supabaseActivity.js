import { supabaseAdmin } from './supabase';

// Backs the public homepage's live activity feed -- genuinely public and
// unauthenticated, so every query here explicitly allowlists columns
// (never select('*')) rather than relying on RLS or a caller to filter
// PII out afterward. order_customers, the full order_addresses row, and
// order_stores' contact fields all carry real customer/vendor PII and must
// never be touched by this file -- only product_name (a point-in-time
// snapshot, safe to show) and city/state from the shipping address.
const ACTIVITY_LOOKBACK_LIMIT = 40; // orders scanned to assemble `limit` entries
const LIVE_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

export async function findRecentActivity({ limit = 8 } = {}) {
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, created_at')
    .in('status', LIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LOOKBACK_LIMIT);

  if (ordersError) {
    console.error('Error finding recent orders for activity feed:', ordersError);
    return [];
  }

  const orderIds = (orders || []).map(o => o.id);
  if (orderIds.length === 0) return [];

  const [{ data: items, error: itemsError }, { data: addresses, error: addressesError }] = await Promise.all([
    supabaseAdmin.from('order_items').select('order_id, product_name').in('order_id', orderIds),
    supabaseAdmin.from('order_addresses').select('order_id, city, state').eq('address_type', 'shipping').in('order_id', orderIds)
  ]);

  if (itemsError) console.error('Error fetching items for activity feed:', itemsError);
  if (addressesError) console.error('Error fetching addresses for activity feed:', addressesError);

  // First item per order only -- the feed shows one representative line per
  // order, not a full receipt.
  const firstItemByOrder = new Map();
  for (const item of items || []) {
    if (!firstItemByOrder.has(item.order_id)) firstItemByOrder.set(item.order_id, item);
  }
  const addressByOrder = new Map((addresses || []).map(a => [a.order_id, a]));

  return orders
    .map(order => {
      const item = firstItemByOrder.get(order.id);
      const address = addressByOrder.get(order.id);
      // Skip rather than show a broken/incomplete line -- an order with no
      // matched item or no city isn't useful proof, it's a rendering bug
      // waiting to happen.
      if (!item?.product_name || !address?.city) return null;
      return {
        productName: item.product_name,
        city: address.city,
        state: address.state || null,
        createdAt: order.created_at
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}
