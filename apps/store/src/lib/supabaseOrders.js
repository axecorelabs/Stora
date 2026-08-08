import { supabaseAdmin } from './supabase';
import { findInventoryById, findActiveBatchesByInventoryId, calculateBatchQuantities } from './supabaseStore';
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
      amount: paymentInfo.amount
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
    orderSource = 'web'
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
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (orderError) {
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
        // Variant fields if present
        variant_color: item.variant?.color || null,
        variant_size: item.variant?.size || null,
        variant_sku: item.variant?.sku || null,
        variant_image: item.variant?.image || null,
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

    // Create order stores snapshots
    console.log('Creating order stores for', items.length, 'items');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const orderItem = orderItems[i];
      
      console.log('Processing item', i, '- storeId:', item.storeId, 'orderItemId:', orderItem.id);
      console.log('Item storeSnapshot:', JSON.stringify(item.storeSnapshot, null, 2));
      
      const storeSnapshot = item.storeSnapshot;
      
      const storeData = {
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
      
      console.log('Inserting order_store:', storeData.store_name, storeData.store_phone);
      
      const { data: insertedStore, error: storeError } = await supabaseAdmin
        .from('order_stores')
        .insert(storeData)
        .select();
      
      if (storeError) {
        console.error('ERROR inserting order_store:', storeError);
        console.error('Failed store data:', storeData);
      } else {
        console.log('Successfully inserted order_store:', insertedStore);
      }
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

// ============ STOCK RESERVATION WITH FIFO ============

export async function reserveStockFIFO(inventoryId, quantityToReserve, variantData = null) {
  if (variantData) {
    // Handle variant stock reservation
    return await reserveVariantStockFIFO(inventoryId, variantData, quantityToReserve);
  }

  // Get active batches for simple products
  const batches = await findActiveBatchesByInventoryId(inventoryId);
  const batchesWithQuantities = await calculateBatchQuantities(batches);
  const activeBatches = batchesWithQuantities
    .filter(b => b.actualQuantityRemaining > 0)
    .sort((a, b) => new Date(a.date_received) - new Date(b.date_received)); // FIFO

  let remaining = quantityToReserve;
  const batchUpdates = [];

  for (const batch of activeBatches) {
    if (remaining <= 0) break;

    const quantityFromBatch = Math.min(remaining, batch.actualQuantityRemaining);
    
    batchUpdates.push({
      id: batch.id,
      quantityReserved: (batch.quantity_reserved || 0) + quantityFromBatch
    });

    remaining -= quantityFromBatch;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock. Need ${remaining} more units.`);
  }

  // Update batches with reserved quantities
  for (const update of batchUpdates) {
    const { error } = await supabaseAdmin
      .from('inventory_batches')
      .update({ quantity_reserved: update.quantityReserved })
      .eq('id', update.id);

    if (error) {
      console.error('Error updating batch reservation:', error);
      throw new Error('Failed to update inventory batch reservation');
    }
  }

  // Update main inventory reserved quantity (doesn't change quantity_in_stock yet)
  const product = await findInventoryById(inventoryId);

  const { error: inventoryError } = await supabaseAdmin
    .from('inventory')
    .update({ 
      quantity_reserved: (product.quantityReserved || 0) + quantityToReserve,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);

  if (inventoryError) {
    console.error('Error updating inventory reservation:', inventoryError);
    throw new Error('Failed to update inventory reservation');
  }

  return { success: true, batchesUsed: batchUpdates.length };
}

async function reserveVariantStockFIFO(inventoryId, variantData, quantityToReserve) {
  const { size, color } = variantData;

  // Get the variant record
  const { data: variants, error: variantError } = await supabaseAdmin
    .from('inventory_variants')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('size', size)
    .eq('color', color)
    .single();

  if (variantError || !variants) {
    throw new Error(`Variant ${color} - ${size} not found`);
  }

  const variant = variants;

  // Check if variant has enough available stock (accounting for already reserved)
  const availableStock = (variant.quantity_in_stock || 0) - (variant.reserved_quantity || 0);
  if (availableStock < quantityToReserve) {
    throw new Error(`Insufficient variant stock. Only ${availableStock} available.`);
  }

  // Get batches for this variant (batches can be variant-specific)
  const { data: variantBatches, error: batchError } = await supabaseAdmin
    .from('inventory_batches')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('status', 'active')
    .order('date_received', { ascending: true }); // FIFO

  if (batchError) {
    console.error('Error fetching variant batches:', batchError);
    throw new Error('Failed to fetch variant batches');
  }

  let remaining = quantityToReserve;
  const batchUpdates = [];

  // Process batches in FIFO order
  for (const batch of variantBatches) {
    if (remaining <= 0) break;

    const batchAvailable = (batch.quantity_in || 0) - (batch.quantity_sold || 0) - (batch.quantity_reserved || 0);
    if (batchAvailable <= 0) continue;

    const quantityFromBatch = Math.min(remaining, batchAvailable);
    
    batchUpdates.push({
      id: batch.id,
      quantityReserved: (batch.quantity_reserved || 0) + quantityFromBatch
    });

    remaining -= quantityFromBatch;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock in batches. Need ${remaining} more units.`);
  }

  // Update batches with reserved quantities
  for (const update of batchUpdates) {
    await supabaseAdmin
      .from('inventory_batches')
      .update({ quantity_reserved: update.quantityReserved })
      .eq('id', update.id);
  }

  // Update variant reserved quantity (doesn't change quantity_in_stock yet)
  await supabaseAdmin
    .from('inventory_variants')
    .update({
      reserved_quantity: (variant.reserved_quantity || 0) + quantityToReserve,
      updated_at: new Date().toISOString()
    })
    .eq('id', variant.id);

  // Update main inventory reserved quantity (sum of all variant reservations)
  const { data: allVariants } = await supabaseAdmin
    .from('inventory_variants')
    .select('reserved_quantity')
    .eq('inventory_id', inventoryId);

  const totalReservedStock = allVariants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;

  await supabaseAdmin
    .from('inventory')
    .update({ 
      quantity_reserved: totalReservedStock,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);

  return { success: true, batchesUsed: batchUpdates.length };
}

// ============ ORDER TRANSFORMATION ============

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
    referralSource: order.referral_source,
    couponCode: order.coupon_code,
    shippingAddress: order.shipping_address,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
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
    inventoryId: item.inventory_id,
    storeId: item.store_id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    productSnapshot: item.product_snapshot,
    storeSnapshot: item.store_snapshot,
    variant: item.variant,
    itemStatus: item.item_status,
    batchId: item.batch_id,
    batchCode: item.batch_code,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// ============ STOCK FULFILLMENT & RELEASE ============

/**
 * Release reserved stock when an order is cancelled
 * Decreases quantity_reserved without affecting quantity_in_stock
 */
export async function releaseOrderReservations(orderId) {
  // Get all order items
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items for release:', itemsError);
    throw new Error('Failed to fetch order items');
  }

  for (const item of orderItems) {
    try {
      if (item.variant) {
        // Handle variant stock release
        await releaseVariantReservation(item.inventory_id, item.variant, item.quantity);
      } else {
        // Handle simple product stock release
        await releaseProductReservation(item.inventory_id, item.quantity);
      }
    } catch (error) {
      console.error(`Error releasing reservation for item ${item.id}:`, error);
      // Continue with other items even if one fails
    }
  }

  return { success: true };
}

/**
 * Fulfill reserved stock when an order is delivered
 * Decreases quantity_reserved, decreases quantity_in_stock, increases quantity_sold
 */
export async function fulfillOrderReservations(orderId) {
  // Get all order items
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error('Error fetching order items for fulfillment:', itemsError);
    throw new Error('Failed to fetch order items');
  }

  for (const item of orderItems) {
    try {
      if (item.variant) {
        // Handle variant stock fulfillment
        await fulfillVariantReservation(item.inventory_id, item.variant, item.quantity);
      } else {
        // Handle simple product stock fulfillment
        await fulfillProductReservation(item.inventory_id, item.quantity);
      }
    } catch (error) {
      console.error(`Error fulfilling reservation for item ${item.id}:`, error);
      // Continue with other items even if one fails
    }
  }

  return { success: true };
}

async function releaseProductReservation(inventoryId, quantity) {
  // Get product current state
  const product = await findInventoryById(inventoryId);
  if (!product) {
    throw new Error('Product not found');
  }

  // Update inventory: decrease quantity_reserved
  await supabaseAdmin
    .from('inventory')
    .update({
      quantity_reserved: Math.max(0, (product.quantityReserved || 0) - quantity),
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);

  // Release from batches (FIFO)
  const batches = await findActiveBatchesByInventoryId(inventoryId);
  const sortedBatches = batches.sort((a, b) => new Date(a.date_received) - new Date(b.date_received));

  let remaining = quantity;
  for (const batch of sortedBatches) {
    if (remaining <= 0) break;
    if ((batch.quantity_reserved || 0) <= 0) continue;

    const releaseFromBatch = Math.min(remaining, batch.quantity_reserved);
    
    await supabaseAdmin
      .from('inventory_batches')
      .update({
        quantity_reserved: (batch.quantity_reserved || 0) - releaseFromBatch
      })
      .eq('id', batch.id);

    remaining -= releaseFromBatch;
  }
}

async function fulfillProductReservation(inventoryId, quantity) {
  // Get product current state
  const product = await findInventoryById(inventoryId);
  if (!product) {
    throw new Error('Product not found');
  }

  // Update inventory: decrease quantity_reserved, decrease quantity_in_stock, increase sold_quantity
  await supabaseAdmin
    .from('inventory')
    .update({
      quantity_reserved: Math.max(0, (product.quantityReserved || 0) - quantity),
      quantity_in_stock: Math.max(0, (product.quantityInStock || 0) - quantity),
      sold_quantity: (product.soldQuantity || 0) + quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);

  // Fulfill from batches (FIFO)
  const batches = await findActiveBatchesByInventoryId(inventoryId);
  const sortedBatches = batches.sort((a, b) => new Date(a.date_received) - new Date(b.date_received));

  let remaining = quantity;
  for (const batch of sortedBatches) {
    if (remaining <= 0) break;
    if ((batch.quantity_reserved || 0) <= 0) continue;

    const fulfillFromBatch = Math.min(remaining, batch.quantity_reserved);
    
    const newQuantityRemaining = Math.max(0, (batch.quantity_in || 0) - (batch.quantity_sold || 0) - fulfillFromBatch);
    const newStatus = newQuantityRemaining <= 0 ? 'depleted' : batch.status;

    await supabaseAdmin
      .from('inventory_batches')
      .update({
        quantity_reserved: (batch.quantity_reserved || 0) - fulfillFromBatch,
        quantity_sold: (batch.quantity_sold || 0) + fulfillFromBatch,
        quantity_remaining: newQuantityRemaining,
        status: newStatus
      })
      .eq('id', batch.id);

    remaining -= fulfillFromBatch;
  }
}

async function releaseVariantReservation(inventoryId, variantData, quantity) {
  const { size, color } = variantData;

  // Get variant
  const { data: variant } = await supabaseAdmin
    .from('inventory_variants')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('size', size)
    .eq('color', color)
    .single();

  if (!variant) {
    throw new Error(`Variant ${color} - ${size} not found`);
  }

  // Update variant: decrease reserved_quantity
  await supabaseAdmin
    .from('inventory_variants')
    .update({
      reserved_quantity: Math.max(0, (variant.reserved_quantity || 0) - quantity),
      updated_at: new Date().toISOString()
    })
    .eq('id', variant.id);

  // Recalculate total inventory reserved from all variants
  const { data: allVariants } = await supabaseAdmin
    .from('inventory_variants')
    .select('reserved_quantity')
    .eq('inventory_id', inventoryId);

  const totalReserved = allVariants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;

  await supabaseAdmin
    .from('inventory')
    .update({
      quantity_reserved: totalReserved,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);
}

async function fulfillVariantReservation(inventoryId, variantData, quantity) {
  const { size, color } = variantData;

  // Get variant
  const { data: variant } = await supabaseAdmin
    .from('inventory_variants')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('size', size)
    .eq('color', color)
    .single();

  if (!variant) {
    throw new Error(`Variant ${color} - ${size} not found`);
  }

  // Update variant: decrease reserved_quantity, decrease quantity_in_stock, increase sold_quantity
  await supabaseAdmin
    .from('inventory_variants')
    .update({
      reserved_quantity: Math.max(0, (variant.reserved_quantity || 0) - quantity),
      quantity_in_stock: Math.max(0, (variant.quantity_in_stock || 0) - quantity),
      sold_quantity: (variant.sold_quantity || 0) + quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', variant.id);

  // Recalculate total inventory metrics from all variants
  const { data: allVariants } = await supabaseAdmin
    .from('inventory_variants')
    .select('reserved_quantity, quantity_in_stock, sold_quantity')
    .eq('inventory_id', inventoryId);

  const totalReserved = allVariants?.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0) || 0;
  const totalInStock = allVariants?.reduce((sum, v) => sum + (v.quantity_in_stock || 0), 0) || 0;
  const totalSold = allVariants?.reduce((sum, v) => sum + (v.sold_quantity || 0), 0) || 0;

  await supabaseAdmin
    .from('inventory')
    .update({
      quantity_reserved: totalReserved,
      quantity_in_stock: totalInStock,
      sold_quantity: totalSold,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryId);
}
