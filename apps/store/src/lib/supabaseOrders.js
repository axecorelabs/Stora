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

  return { orders: data || [], totalCount: count || 0 };
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
  
  console.log('Shipping address fetched for order:', orderId, shippingAddress);

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

  // Fetch store snapshots
  const { data: orderStores, error: storesError } = await supabaseAdmin
    .from('order_stores')
    .select('*')
    .in('order_item_id', transformedItems.map(item => item.id));

  if (storesError) {
    console.error('Error fetching order stores:', storesError);
  }
  
  console.log('Order stores fetched:', orderStores?.length, 'for', transformedItems.length, 'items');

  // Create store lookup map
  const storeMap = new Map();
  if (orderStores) {
    for (const store of orderStores) {
      console.log('Processing store from order_stores:', {
        store_id: store.store_id,
        store_name: store.store_name,
        store_phone: store.store_phone
      });
      
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
  
    // Group items by store
    const storeGroups = {};
    for (const item of transformedItems) {
      const storeId = item.storeId;
      const storeInfo = storeMap.get(storeId);
      
      if (!storeGroups[storeId]) {
        console.log('Creating store group for:', storeId, 'storeInfo exists:', !!storeInfo);
        
        storeGroups[storeId] = {
        storeId,
        storeName: storeInfo?.storeName || 'Unknown Store',
        storePhone: storeInfo?.storePhone || null,
        storeEmail: storeInfo?.storeEmail || null,
        storeSnapshot: storeInfo?.storeSnapshot || null,
        items: [],
        itemCount: 0,
        subtotal: 0,
        status: 'pending'
      };
    }
    storeGroups[storeId].items.push(item);
    storeGroups[storeId].itemCount += item.quantity;
    storeGroups[storeId].subtotal += parseFloat(item.subtotal || 0);
  }

const stores = Object.values(storeGroups);

console.log('Final stores array:', stores.map(s => ({ name: s.storeName, phone: s.storePhone })));

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
    stores: stores, // Grouped by store
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
  
  console.log('Returning formatted order:', formattedOrder.orderNumber, formattedOrder.totalAmount);
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
    // Create order customer snapshot
    const { error: customerError } = await supabaseAdmin
      .from('order_customers')
      .insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        email: shippingAddress.email || '',
        phone: shippingAddress.phone,
        created_at: now,
        updated_at: now
      });

    if (customerError) {
      console.error('Error creating order customer:', customerError);
    }

    // Create shipping address
    const { error: addressError } = await supabaseAdmin
      .from('order_addresses')
      .insert({
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
      });

    if (addressError) {
      console.error('Error creating order address:', addressError);
    }

    // Create payment record
    const { error: paymentError } = await supabaseAdmin
      .from('order_payments')
      .insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        method: paymentMethod,
        provider: 'manual',
        status: 'pending',
        amount: totalAmount,
        created_at: now,
        updated_at: now
      });

    if (paymentError) {
      console.error('Error creating order payment:', paymentError);
    }

    // Create order items with full snapshots
    const orderItemsData = [];
    for (const item of items) {
      const orderItemData = {
        id: crypto.randomUUID(),
        order_id: order.id,
        product_id: item.productId,
        store_id: item.storeId,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.subtotal,
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
      };
      orderItemsData.push(orderItemData);
    }

    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsData)
      .select();

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      throw new Error('Failed to create order items');
    }

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

    // Create initial timeline entry
    await supabaseAdmin
      .from('order_timeline')
      .insert({
        id: crypto.randomUUID(),
        order_id: order.id,
        status: 'pending',
        from_status: null,
        note: 'Order created',
        updated_by: 'customer',
        timestamp: now
      });

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
    items: order.order_items?.map(transformOrderItemFields) || []
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

export async function reserveStock(inventoryId, quantity, variantId = null) {
  const { data, error } = await supabaseAdmin.rpc('fn_reserve_stock', {
    p_inventory_id: inventoryId,
    p_variant_id: variantId || null,
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

export async function releaseStockReservation(inventoryId, quantity, variantId = null) {
  const { data, error } = await supabaseAdmin.rpc('fn_release_stock_reservation', {
    p_inventory_id: inventoryId,
    p_variant_id: variantId || null,
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
    inventory_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: item.quantity
  }));

  const { error } = await supabaseAdmin.rpc('fn_release_stock_reservations_bulk', {
    p_items: items
  });

  if (error) {
    console.error('Error releasing order reservations:', error);
    throw new Error('Failed to release order reservations');
  }

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
    inventory_id: item.product_id,
    variant_id: item.variant_id || null,
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
