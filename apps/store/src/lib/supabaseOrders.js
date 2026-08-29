import { supabaseAdmin } from './supabase';
import { findCustomerById } from './supabaseAuth';

// ============ ORDER HELPER FUNCTIONS ============

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// ============ ORDER OPERATIONS ============

export async function findOrdersByCustomerId(customerId, options = {}) {
  const {
    page = 1,
    limit = 10,
    statuses = []
  } = options;

  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statuses.length > 0) {
    query = query.in('status', statuses);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error finding orders:', error);
    throw new Error('Failed to find orders');
  }

  const orders = data || [];

  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);

    // One batched query for this page's payment rows instead of one query
    // per order -- attached as order.order_payments[0] so transformOrderFields
    // can shape it the same way findOrderById's single-order payment object
    // already is (this list endpoint never fetched payment data at all
    // before, which is what let OrderDetailsPanel.js read a field that
    // was always undefined).
    const { data: payments } = await supabaseAdmin
      .from('order_payments')
      .select('*')
      .in('order_id', orderIds);

    const paymentByOrderId = new Map((payments || []).map(p => [p.order_id, p]));
    for (const order of orders) {
      order.order_payments = paymentByOrderId.has(order.id) ? [paymentByOrderId.get(order.id)] : [];
    }

    // Same gap as payments, but worse: OrderDetailsPanel.js reads
    // order.shippingAddress.firstName with no optional chaining at all, so
    // this wasn't a silently-wrong field like itemCount/stores below -- it
    // was a hard crash the moment anyone opened the panel for any order,
    // since this list endpoint never fetched order_addresses either.
    const { data: addresses } = await supabaseAdmin
      .from('order_addresses')
      .select('*')
      .in('order_id', orderIds)
      .eq('address_type', 'shipping');

    const addressByOrderId = new Map((addresses || []).map(a => [a.order_id, a]));
    for (const order of orders) {
      order.shipping_address = addressByOrderId.get(order.id) || null;
    }

    // order_stores is keyed by order_item_id (one snapshot per line item's
    // vendor, written at checkout -- see orders/create/route.js), not by
    // order_id directly -- batch it the same way and attach per item so
    // transformOrderFields can group by vendor below. Neither this nor
    // itemCount existed anywhere on the transformed shape before, despite
    // both the list card and the detail panel reading them.
    const allItemIds = orders.flatMap(o => (o.order_items || []).map(i => i.id));
    if (allItemIds.length > 0) {
      const { data: orderStores } = await supabaseAdmin
        .from('order_stores')
        .select('order_item_id, store_id, store_name')
        .in('order_item_id', allItemIds);

      const storeByItemId = new Map((orderStores || []).map(s => [s.order_item_id, s]));
      for (const order of orders) {
        for (const item of order.order_items || []) {
          item.order_store = storeByItemId.get(item.id) || null;
        }
      }
    }
  }

  return { orders, totalCount: count || 0 };
}

export async function findOrderById(orderId, customerId = null) {
  // Fetch order
  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: order, error } = await query;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding order:', error);
    throw new Error('Failed to find order');
  }

  // Manually fetch order items
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items:', itemsError);
  }

  // Transform order items to match expected structure
  const transformedItems = orderItems?.map(item => ({
    id: item.id,
    productId: item.product_id,
    storeId: item.store_id,
    quantity: item.quantity,
    price: parseFloat(item.unit_price || 0),
    unitPrice: parseFloat(item.unit_price || 0),
    subtotal: parseFloat(item.subtotal || 0),
    itemStatus: item.item_status,
    notes: item.notes || null,
    modifiers: item.modifiers || null,
    // Product snapshot
    productSnapshot: {
      productName: item.product_name,
      sku: item.product_sku,
      image: item.product_image || item.variant_image,
      category: item.product_category
    },
    // Variant info if present
    variant: item.variant_color || item.variant_size ? {
      color: item.variant_color,
      size: item.variant_size,
      sku: item.variant_sku,
      image: item.variant_image
    } : null,
    batchId: item.batch_id,
    batchCode: item.batch_code
  })) || [];

  // Fetch shipping address
  const { data: shippingAddress, error: addressError } = await supabaseAdmin
    .from('order_addresses')
    .select('*')
    .eq('order_id', orderId)
    .eq('address_type', 'shipping')
    .single();

  if (addressError && addressError.code !== 'PGRST116') {
    console.error('Error fetching shipping address:', addressError);
  }

  // Fetch customer info
  const { data: customerInfo, error: customerError } = await supabaseAdmin
    .from('order_customers')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (customerError && customerError.code !== 'PGRST116') {
    console.error('Error fetching customer info:', customerError);
  }

  // Fetch payment info
  const { data: paymentInfo, error: paymentError } = await supabaseAdmin
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (paymentError && paymentError.code !== 'PGRST116') {
    console.error('Error fetching payment info:', paymentError);
  }

  // Which stores are covered by this order's one combined online payment --
  // a store with a split row here is being paid through that single charge
  // (pending or already resolved), not something to route to WhatsApp
  // contact for. Payment is all-or-nothing at the order level (one
  // order_payments row, no independent per-store payment events), so this
  // is a clean split: a store is either in this set or genuinely contact-
  // only, never both.
  const { data: paymentSplits, error: splitsError } = await supabaseAdmin
    .from('order_payment_splits')
    .select('store_id')
    .eq('order_id', orderId);

  if (splitsError) {
    console.error('Error fetching payment splits:', splitsError);
  }

  const onlinePaymentStoreIds = new Set((paymentSplits || []).map(s => s.store_id));

  // Fetch store snapshots
  const { data: orderStores, error: storesError } = await supabaseAdmin
    .from('order_stores')
    .select('*')
    .in('order_item_id', transformedItems.map(item => item.id));

  if (storesError) {
    console.error('Error fetching order stores:', storesError);
  }

  // Create store lookup map
  const storeMap = new Map();
  if (orderStores) {
    for (const store of orderStores) {
      if (!storeMap.has(store.store_id)) {
        storeMap.set(store.store_id, {
          storeId: store.store_id,
          storeName: store.store_name,
          storeSlug: store.store_slug,
          storePhone: store.store_phone,
          storeEmail: store.store_email,
          storeSnapshot: {
            store_name: store.store_name,
            store_slug: store.store_slug,
            store_phone: store.store_phone,
            store_email: store.store_email,
            address: {
              street: store.street,
              city: store.city,
              state: store.state,
              country: store.country,
              postalCode: store.postal_code
            },
            onlineStoreInfo: {
              website: store.website,
              socialMedia: {
                instagram: store.instagram,
                facebook: store.facebook,
                twitter: store.twitter,
                tiktok: store.tiktok,
                whatsapp: store.whatsapp
              }
            },
            branding: {
              logo: store.logo,
              primaryColor: store.primary_color,
              secondaryColor: store.secondary_color
            }
          }
        });
      }
    }
  }

  // Group items by store. status mirrors the order's own status rather
  // than a hardcoded 'pending' -- there's no independent per-vendor
  // fulfillment status tracked separately from the order as a whole, so a
  // delivered/cancelled order previously still showed every store card as
  // "pending" regardless of what actually happened.
  const storeGroups = {};
  for (const item of transformedItems) {
    const storeId = item.storeId;
    const storeInfo = storeMap.get(storeId);

    if (!storeGroups[storeId]) {
      storeGroups[storeId] = {
        storeId,
        storeName: storeInfo?.storeName || 'Unknown Store',
        storePhone: storeInfo?.storePhone || null,
        storeEmail: storeInfo?.storeEmail || null,
        storeSnapshot: storeInfo?.storeSnapshot || null,
        items: [],
        itemCount: 0,
        subtotal: 0,
        status: order.status
      };
    }
    storeGroups[storeId].items.push(item);
    storeGroups[storeId].itemCount += item.quantity;
    storeGroups[storeId].subtotal += parseFloat(item.subtotal || 0);
  }

  const stores = Object.values(storeGroups);

  // Format and return order with all related data
  const formattedOrder = {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    subtotal: parseFloat(order.subtotal || 0),
    tax: parseFloat(order.tax || 0),
    shippingFee: parseFloat(order.shipping_fee || 0),
    discount: parseFloat(order.discount || 0),
    couponDiscount: parseFloat(order.coupon_discount || 0),
    totalAmount: parseFloat(order.total_amount || 0),
    status: order.status,
    fulfillmentStatus: order.fulfillment_status,
    customerNotes: order.customer_notes,
    adminNotes: order.admin_notes,
    orderSource: order.order_source,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    // Related data
    order_items: transformedItems,
    items: transformedItems, // Alias for compatibility
    itemCount: transformedItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
    stores: stores, // Grouped by store, all of them
    // Scoped subset for the WhatsApp-contact flow -- stores with no online
    // payment covering their items at all, as opposed to stores just
    // mid-payment on the one combined charge. Showing "this seller doesn't
    // accept online payment" for a store that actually does (just hasn't
    // been paid yet) would be actively misleading.
    contactOnlyStores: stores.filter(s => !onlinePaymentStoreIds.has(s.storeId)),
    shippingAddress: shippingAddress ? {
      firstName: shippingAddress.first_name,
      lastName: shippingAddress.last_name,
      phone: shippingAddress.phone,
      street: shippingAddress.street,
      city: shippingAddress.city,
      state: shippingAddress.state,
      country: shippingAddress.country,
      postalCode: shippingAddress.postal_code,
      landmark: shippingAddress.landmark
    } : null,
    customerSnapshot: customerInfo ? {
      firstName: customerInfo.first_name,
      lastName: customerInfo.last_name,
      email: customerInfo.email,
      phone: customerInfo.phone
    } : null,
    payment: paymentInfo ? {
      method: paymentInfo.method,
      provider: paymentInfo.provider,
      status: paymentInfo.status,
      amount: paymentInfo.amount,
      reference: paymentInfo.reference,
      transactionId: paymentInfo.transaction_id,
      paidAt: paymentInfo.paid_at
    } : null
  };

  return formattedOrder;
}

export async function getOrderStats(customerId) {
  // Get order counts by status
  const { data: statusCounts, error: statusError } = await supabaseAdmin
    .from('orders')
    .select('status')
    .eq('customer_id', customerId);

  if (statusError) {
    console.error('Error getting order stats:', statusError);
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
  }

  const stats = {
    total: statusCounts.length,
    pending: statusCounts.filter(o => o.status === 'pending').length,
    confirmed: statusCounts.filter(o => o.status === 'confirmed').length,
    processing: statusCounts.filter(o => o.status === 'processing').length,
    shipped: statusCounts.filter(o => o.status === 'shipped').length,
    delivered: statusCounts.filter(o => o.status === 'delivered').length,
    cancelled: statusCounts.filter(o => o.status === 'cancelled').length
  };

  return stats;
}

export async function createOrder(orderData) {
  const {
    customerId,
    items,
    shippingAddress,
    subtotal,
    tax = 0,
    shippingFee = 0,
    discount = 0,
    couponDiscount = 0,
    totalAmount,
    customerNotes = '',
    paymentMethod = 'cash_to_vendor',
    orderSource = 'web',
    idempotencyKey = null
  } = orderData;

  // Generate order number
  const orderNumber = generateOrderNumber();
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
      subtotal,
      tax,
      shipping_fee: shippingFee,
      discount,
      coupon_discount: couponDiscount,
      total_amount: totalAmount,
      status: 'pending',
      fulfillment_status: 'pending',
      customer_notes: customerNotes,
      order_source: orderSource,
      idempotency_key: idempotencyKey,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (orderError) {
    // Unique violation on idempotency_key means a concurrent/retried request
    // already created this order -- return the winner instead of erroring.
    if (orderError.code === '23505' && idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('idempotency_key', idempotencyKey)
        .single();
      if (existing) {
        // Signal to the caller that this request lost the race and did not
        // create the returned order -- it must release any stock it already
        // reserved itself before returning this order to the client.
        return { ...existing, _wasExistingOrder: true };
      }
    }
    console.error('Error creating order:', orderError);
    throw new Error('Failed to create order');
  }

  try {
    // Create order items with full snapshots -- built up front so its
    // insert can run in the same parallel batch as the other four writes
    // below, all of which only depend on order.id/now and not on each
    // other.
    const orderItemsData = items.map(item => ({
      id: crypto.randomUUID(),
      order_id: order.id,
      product_id: item.productId,
      store_id: item.storeId,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.subtotal,
      notes: item.notes || null,
      modifiers: item.modifiers || null,
      item_status: 'pending',
      batch_id: item.batchId || null,
      batch_code: item.batchCode || null,
      // Product snapshot fields
      product_name: item.productSnapshot?.product_name || item.productSnapshot?.productName,
      product_sku: item.productSnapshot?.sku,
      product_image: item.productSnapshot?.primary_image || item.productSnapshot?.image,
      product_category: item.productSnapshot?.category,
      product_brand: item.productSnapshot?.brand,
      // Variant fields -- sourced from the real variant identity the
      // caller resolved (item.variantId etc.), not a nonexistent
      // cartItem.variant column (see orders/create/route.js)
      variant_id: item.variantId || null,
      variant_color: item.variantColor || null,
      variant_size: item.variantSize || null,
      variant_sku: item.variantSku || null,
      variant_image: item.variantImage || null,
      created_at: now,
      updated_at: now
    }));

    // Five independent writes, each keyed only off order.id/now -- none
    // reads another's result, so they run as one round trip's worth of
    // latency instead of five sequential ones. order_customers/
    // order_addresses/order_payments/order_timeline stay non-fatal
    // (logged, not thrown) exactly as before; order_items is the one that
    // still throws, which still triggers the outer catch's order rollback.
    const [, , , , itemsResult] = await Promise.all([
      supabaseAdmin.from('order_customers').insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        email: shippingAddress.email || '',
        phone: shippingAddress.phone,
        created_at: now,
        updated_at: now
      }).then(({ error }) => { if (error) console.error('Error creating order customer:', error); }),

      supabaseAdmin.from('order_addresses').insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        address_type: 'shipping',
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        phone: shippingAddress.phone,
        street: shippingAddress.street || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country || 'Nigeria',
        postal_code: shippingAddress.postalCode || '',
        landmark: shippingAddress.landmark || '',
        created_at: now,
        updated_at: now
      }).then(({ error }) => { if (error) console.error('Error creating order address:', error); }),

      supabaseAdmin.from('order_payments').insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        method: paymentMethod,
        provider: 'manual',
        status: 'pending',
        amount: totalAmount,
        created_at: now,
        updated_at: now
      }).then(({ error }) => { if (error) console.error('Error creating order payment:', error); }),

      supabaseAdmin.from('order_timeline').insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        status: 'pending',
        from_status: null,
        note: 'Order created',
        updated_by: 'customer',
        timestamp: now
      }).then(({ error }) => { if (error) console.error('Error creating order timeline entry:', error); }),

      supabaseAdmin.from('order_items').insert(orderItemsData).select()
    ]);

    if (itemsResult.error) {
      console.error('Error creating order items:', itemsResult.error);
      throw new Error('Failed to create order items');
    }
    const orderItems = itemsResult.data;

    // Create order stores snapshots -- one bulk insert instead of one
    // round trip per item (mirrors the order_items insert above, which
    // already did this correctly).
    console.log('Creating order stores for', items.length, 'items');
    const orderStoresData = items.map((item, i) => {
      const orderItem = orderItems[i];
      const storeSnapshot = item.storeSnapshot;

      return {
        id: crypto.randomUUID(),
        order_item_id: orderItem.id,
        store_id: item.storeId,
        store_name: storeSnapshot?.store_name || storeSnapshot?.storeName,
        store_slug: storeSnapshot?.store_slug || storeSnapshot?.storeSlug,
        store_phone: storeSnapshot?.store_phone || storeSnapshot?.storePhone,
        store_email: storeSnapshot?.store_email || storeSnapshot?.storeEmail,
        // Store business address
        street: storeSnapshot?.address?.street || null,
        city: storeSnapshot?.address?.city || null,
        state: storeSnapshot?.address?.state || null,
        country: storeSnapshot?.address?.country || 'Nigeria',
        postal_code: storeSnapshot?.address?.postalCode || null,
        // Online presence
        website: storeSnapshot?.onlineStoreInfo?.website || storeSnapshot?.online_store_info?.website || null,
        instagram: storeSnapshot?.onlineStoreInfo?.socialMedia?.instagram || storeSnapshot?.online_store_info?.socialMedia?.instagram || null,
        facebook: storeSnapshot?.onlineStoreInfo?.socialMedia?.facebook || storeSnapshot?.online_store_info?.socialMedia?.facebook || null,
        twitter: storeSnapshot?.onlineStoreInfo?.socialMedia?.twitter || storeSnapshot?.online_store_info?.socialMedia?.twitter || null,
        tiktok: storeSnapshot?.onlineStoreInfo?.socialMedia?.tiktok || storeSnapshot?.online_store_info?.socialMedia?.tiktok || null,
        whatsapp: storeSnapshot?.onlineStoreInfo?.socialMedia?.whatsapp || storeSnapshot?.online_store_info?.socialMedia?.whatsapp || null,
        // Branding
        logo: storeSnapshot?.branding?.logo || null,
        primary_color: storeSnapshot?.branding?.primaryColor || storeSnapshot?.branding?.primary_color || null,
        secondary_color: storeSnapshot?.branding?.secondaryColor || storeSnapshot?.branding?.secondary_color || null,
        created_at: now,
        updated_at: now
      };
    });

    const { data: insertedStores, error: storesError } = await supabaseAdmin
      .from('order_stores')
      .insert(orderStoresData)
      .select();

    if (storesError) {
      console.error('ERROR inserting order_stores:', storesError);
      console.error('Failed store data:', orderStoresData);
    } else {
      console.log('Successfully inserted order_stores:', insertedStores.length);
    }

    return { ...order, order_items: orderItems };
  } catch (error) {
    // Rollback order creation on any error
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    throw error;
  }
}

export async function updateOrderStatus(orderId, status, customerId = null) {
  // Get current order to track previous status and handle stock changes
  const { data: currentOrder } = await supabaseAdmin
    .from('orders')
    .select('status, order_items(*)')
    .eq('id', orderId)
    .single();

  const previousStatus = currentOrder?.status;

  // Handle stock changes based on status transition
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    // Release all reserved stock
    await releaseOrderReservations(orderId);
  } else if (status === 'delivered' && previousStatus !== 'delivered' && previousStatus !== 'cancelled') {
    // Fulfill reservations (move from reserved to sold)
    await fulfillOrderReservations(orderId);
  }

  let query = supabaseAdmin
    .from('orders')
    .update({ 
      status, 
      updated_at: new Date().toISOString(),
      // Update status timestamps
      ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() }),
      ...(status === 'confirmed' && { confirmed_at: new Date().toISOString() }),
      ...(status === 'shipped' && { shipped_at: new Date().toISOString() }),
      ...(status === 'delivered' && { delivered_at: new Date().toISOString() })
    })
    .eq('id', orderId);

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query.select().single();

  if (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status');
  }

  // Create timeline entry
  await supabaseAdmin
    .from('order_timeline')
    .insert({
      order_id: orderId,
      status: status,
      from_status: previousStatus,
      note: `Order status changed to ${status}`,
      updated_by: customerId ? 'customer' : 'system',
      timestamp: new Date().toISOString()
    });

  return data;
}

export async function updateOrderItemStatus(orderItemId, status) {
  const { data, error } = await supabaseAdmin
    .from('order_items')
    .update({ item_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderItemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating order item status:', error);
    throw new Error('Failed to update order item status');
  }

  return data;
}

// ============ ORDER TRANSFORMATION ============
//
// order_items carries product_id/variant_color/variant_size/variant_sku
// (not the old inventory_id/variant columns) and store info now lives in
// the separate order_stores table -- see findOrderById's inline transform,
// which this mirrors.

export function transformOrderFields(order) {
  if (!order) return null;

  const items = order.order_items?.map(transformOrderItemFields) || [];
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Group by vendor using order_store (attached per-item by
  // findOrdersByCustomerId's batched lookup, keyed off order_item_id --
  // that's where the snapshot actually lives, not on the order itself).
  // itemCount/subtotal here are figures the caller (order card, detail
  // panel) reads with no equivalent anywhere before this.
  const storesByStoreId = new Map();
  (order.order_items || []).forEach((rawItem, idx) => {
    const store = rawItem.order_store;
    if (!store) return;
    if (!storesByStoreId.has(store.store_id)) {
      storesByStoreId.set(store.store_id, {
        storeId: store.store_id,
        storeName: store.store_name,
        itemCount: 0,
        subtotal: 0
      });
    }
    const entry = storesByStoreId.get(store.store_id);
    entry.itemCount += items[idx]?.quantity || 0;
    entry.subtotal += items[idx]?.subtotal || 0;
  });

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    subtotal: order.subtotal,
    tax: order.tax,
    shippingFee: order.shipping_fee,
    discount: order.discount,
    couponDiscount: order.coupon_discount,
    totalAmount: order.total_amount,
    status: order.status,
    fulfillmentStatus: order.fulfillment_status,
    customerNotes: order.customer_notes,
    adminNotes: order.admin_notes,
    orderSource: order.order_source,
    confirmedAt: order.confirmed_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items,
    itemCount,
    stores: Array.from(storesByStoreId.values()),
    // order.order_payments[0] is attached by findOrdersByCustomerId's
    // batched payment lookup -- same shape as findOrderById's `payment`
    // field, so both order-detail surfaces (this list panel and the
    // single-order page) read a consistently-named field.
    payment: order.order_payments?.[0] ? {
      method: order.order_payments[0].method,
      provider: order.order_payments[0].provider,
      status: order.order_payments[0].status,
      amount: order.order_payments[0].amount,
      reference: order.order_payments[0].reference,
      transactionId: order.order_payments[0].transaction_id,
      paidAt: order.order_payments[0].paid_at
    } : null,
    // order.shipping_address is attached by findOrdersByCustomerId's
    // batched order_addresses lookup -- same shape findOrderById already
    // builds inline for the single-order page.
    shippingAddress: order.shipping_address ? {
      firstName: order.shipping_address.first_name,
      lastName: order.shipping_address.last_name,
      phone: order.shipping_address.phone,
      street: order.shipping_address.street,
      city: order.shipping_address.city,
      state: order.shipping_address.state,
      country: order.shipping_address.country,
      postalCode: order.shipping_address.postal_code,
      landmark: order.shipping_address.landmark
    } : null
  };
}

export function transformOrderItemFields(item) {
  if (!item) return null;

  return {
    id: item.id,
    orderId: item.order_id,
    productId: item.product_id,
    storeId: item.store_id,
    quantity: item.quantity,
    price: parseFloat(item.unit_price || 0),
    unitPrice: parseFloat(item.unit_price || 0),
    subtotal: parseFloat(item.subtotal || 0),
    itemStatus: item.item_status,
    notes: item.notes || null,
    modifiers: item.modifiers || null,
    productSnapshot: {
      productName: item.product_name,
      sku: item.product_sku,
      image: item.product_image,
      category: item.product_category,
      brand: item.product_brand
    },
    variant: item.variant_color || item.variant_size || item.variant_sku ? {
      color: item.variant_color,
      size: item.variant_size,
      sku: item.variant_sku,
      image: item.variant_image
    } : null,
    batchId: item.batch_id,
    batchCode: item.batch_code,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// ============ ATOMIC STOCK RESERVATION (via Postgres RPC) ============
//
// Every reservation/release/fulfillment mutation goes through
// fn_reserve_stock / fn_release_stock_reservation / fn_fulfill_stock_reservation
// (apps/dashboard/supabase/migrations/20260814000001_stock_reservation_functions.sql).
// Each call is a single locked Postgres transaction -- the batch FIFO walk
// and the parent inventory/variant row update happen atomically, so
// concurrent reservations against the same product/variant can't oversell
// it. Nothing here re-implements FIFO math or reads-then-writes quantities
// in JS anymore; apps/dashboard/src/lib/batchInventory.js (POS) calls the
// same functions.

// variantId is required now -- every product has >=1 real variant row
// (20260817000001_unify_inventory_variants.sql), and the RPCs themselves
// are variant-only (20260817000002_variant_only_rpcs.sql). Callers resolve
// it at add-to-cart time (see supabaseCart.js's prepareCartItemData), so
// by the time checkout reserves stock, there's always a real one.
export async function reserveStock(variantId, quantity) {
  if (!variantId) {
    throw new Error('reserveStock requires a variantId');
  }
  const { data, error } = await supabaseAdmin.rpc('fn_reserve_stock', {
    p_variant_id: variantId,
    p_quantity: quantity
  });

  if (error) {
    console.error('Error reserving stock:', error);
    throw new Error('Failed to reserve stock');
  }

  const result = data?.[0];
  if (!result?.success) {
    throw new Error(`Insufficient stock. Need ${result?.shortfall ?? quantity} more units.`);
  }

  return { success: true, reservedQuantity: result.reserved_qty, batches: result.batches || [] };
}

export async function releaseStockReservation(variantId, quantity) {
  if (!variantId) {
    throw new Error('releaseStockReservation requires a variantId');
  }
  const { data, error } = await supabaseAdmin.rpc('fn_release_stock_reservation', {
    p_variant_id: variantId,
    p_quantity: quantity
  });

  if (error) {
    console.error('Error releasing stock reservation:', error);
    throw new Error('Failed to release stock reservation');
  }

  return { success: true, releasedQuantity: data?.[0]?.released_quantity ?? 0 };
}

/**
 * Release all reserved stock for every item on a cancelled order, in one
 * round trip via fn_release_stock_reservations_bulk (20260815000000
 * migration) instead of one RPC call per item -- on a multi-item order
 * that used to be N sequential round trips blocking the caller (the
 * abandoned-payment cleanup job, or a customer/vendor cancelling).
 * order_items carries product_id (not inventory_id) and variant_id
 * (not a nested `variant` object) -- reading the wrong column names here
 * used to make this silently no-op for every order.
 */
export async function releaseOrderReservations(orderId) {
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items for release:', itemsError);
    throw new Error('Failed to fetch order items');
  }

  if (!orderItems || orderItems.length === 0) return { success: true };

  const items = orderItems.map(item => ({
    variant_id: item.variant_id,
    quantity: item.quantity
  }));

  const { error } = await supabaseAdmin.rpc('fn_release_stock_reservations_bulk', {
    p_items: items
  });

  if (error) {
    console.error('Error releasing order reservations:', error);
    throw new Error('Failed to release order reservations');
  }

  // Free up any cart items that were flagged as payment-pending for this
  // order (see orders/create/route.js's duplicate-checkout guard) -- once
  // the order is cancelled, those items are available for a fresh
  // checkout attempt again instead of being permanently stuck pointing at
  // a dead order. Non-fatal: a failed unflag just means a future checkout
  // attempt on the same item is blocked until this is retried/fixed
  // manually, not a stock-safety issue.
  const { error: unflagError } = await supabaseAdmin
    .from('cart_items')
    .update({ pending_order_id: null })
    .eq('pending_order_id', orderId);
  if (unflagError) console.error('Error clearing pending_order_id after cancellation:', unflagError);

  return { success: true };
}

/**
 * Fulfill reserved stock for every item on a delivered order (moves
 * reserved -> sold), in one round trip via fn_fulfill_stock_reservations_bulk
 * instead of one RPC call per item. Same product_id/variant_id fix as
 * releaseOrderReservations.
 */
export async function fulfillOrderReservations(orderId) {
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items for fulfillment:', itemsError);
    throw new Error('Failed to fetch order items');
  }

  if (!orderItems || orderItems.length === 0) return { success: true };

  const items = orderItems.map(item => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    reason: 'Order delivered'
  }));

  const { error } = await supabaseAdmin.rpc('fn_fulfill_stock_reservations_bulk', {
    p_items: items,
    p_user_id: null,
    p_related_order_id: orderId
  });

  if (error) {
    console.error('Error fulfilling order reservations:', error);
    throw new Error('Failed to fulfill order reservations');
  }

  return { success: true };
}
