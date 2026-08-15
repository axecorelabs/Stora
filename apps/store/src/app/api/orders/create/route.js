import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyCustomerSession } from "@/lib/auth";
import { sendNewOrderNotification } from "@/lib/email";
import { createOrder, reserveStock, releaseStockReservation } from "@/lib/supabaseOrders";
import { getOrCreateCart, clearCart } from "@/lib/supabaseCart";
import { findInventoryByIds } from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";

const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.1');

// Groups an order's items by store, matching each item up with its
// order_stores snapshot -- the single source of truth both the payment
// split (payable vs WhatsApp-contact-only vendors) and the vendor email/
// notification loop key off, so the two can never drift apart.
async function groupOrderItemsByStore(order) {
  const { data: orderStores } = await supabaseAdmin
    .from('order_stores')
    .select('*')
    .in('order_item_id', order.order_items.map(item => item.id));

  const storeMap = new Map();
  for (const store of orderStores || []) {
    storeMap.set(store.store_id, store);
  }

  const storeGroupedItems = {};
  for (const item of order.order_items) {
    const storeId = item.store_id;
    if (!storeGroupedItems[storeId]) {
      storeGroupedItems[storeId] = { store: storeMap.get(storeId), items: [], total: 0 };
    }
    storeGroupedItems[storeId].items.push(item);
    storeGroupedItems[storeId].total += parseFloat(item.subtotal);
  }

  return storeGroupedItems;
}

// Computes and persists the per-vendor payment-split breakdown for a
// Paystack order. Only ever covers payable (paystack_ready) stores --
// non-ready stores' items stay on the existing WhatsApp-contact path
// (see apps/store/src/app/[slug]/cart/page.js), never enter a split.
// Deliberately isolated from the email/notification block: a failure
// here must not silently disappear the way a failed notification email
// can, since a missing split record breaks payment initiation later --
// callers check the returned paymentSplitError instead.
async function computePaymentSplit(order, storeGroupedItems) {
  const storeIds = Object.keys(storeGroupedItems);
  const { data: stores, error: storesError } = await supabaseAdmin
    .from('stores')
    .select('id, paystack_ready, bank_details')
    .in('id', storeIds);

  if (storesError) throw storesError;

  const readyStoreIds = new Set((stores || []).filter(s => s.paystack_ready).map(s => s.id));
  const subaccountByStoreId = new Map(
    (stores || []).map(s => [s.id, s.bank_details?.paystack_subaccount_code])
  );

  const payableStoreIds = storeIds.filter(id => readyStoreIds.has(id));
  const contactOnlyStoreIds = storeIds.filter(id => !readyStoreIds.has(id));

  if (payableStoreIds.length === 0) {
    return { payableStoreIds, contactOnlyStoreIds, payableSubtotal: 0 };
  }

  const { data: orderPayment, error: paymentFetchError } = await supabaseAdmin
    .from('order_payments')
    .select('id')
    .eq('order_id', order.id)
    .single();

  if (paymentFetchError || !orderPayment) {
    throw paymentFetchError || new Error('order_payments row not found');
  }

  const splitRows = [];
  let payableSubtotal = 0;

  for (const storeId of payableStoreIds) {
    const grossAmount = storeGroupedItems[storeId].total;
    const commissionAmount = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
    const netAmount = grossAmount - commissionAmount;
    payableSubtotal += grossAmount;

    splitRows.push({
      id: crypto.randomUUID(),
      order_id: order.id,
      order_payment_id: orderPayment.id,
      store_id: storeId,
      subaccount_code: subaccountByStoreId.get(storeId),
      gross_amount: grossAmount,
      platform_commission_rate: PLATFORM_COMMISSION_RATE,
      platform_commission_amount: commissionAmount,
      net_amount_to_vendor: netAmount
    });
  }

  const { error: splitInsertError } = await supabaseAdmin.from('order_payment_splits').insert(splitRows);
  if (splitInsertError) throw splitInsertError;

  // order_payments.amount only ever covers the payable portion -- never
  // the full order total on a mixed cart, since Paystack is only ever
  // asked to collect what it's actually splitting to a subaccount.
  const { error: paymentUpdateError } = await supabaseAdmin
    .from('order_payments')
    .update({ amount: payableSubtotal, provider: 'paystack', method: 'paystack', updated_at: new Date().toISOString() })
    .eq('id', orderPayment.id);

  if (paymentUpdateError) throw paymentUpdateError;

  return { payableStoreIds, contactOnlyStoreIds, payableSubtotal };
}

async function fetchStoreData(storeId) {
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) {
    console.error('Error fetching store data:', error);
    return null;
  }

  console.log('Fetched store data for order:', {
    id: store.id,
    name: store.store_name,
    phone: store.store_phone,
    email: store.store_email,
    online_store_info: store.online_store_info,
    has_online_info: !!store.online_store_info
  });

  return store;
}

function orderSummary(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    totalAmount: order.total_amount,
    status: order.status
  };
}

export async function POST(request) {
  // Reservations made so far in this request -- released on any failure past
  // that point so a partial cart never leaves stock reserved with no order,
  // or an order with only some of its items actually backed by stock. Once
  // the order is successfully created, these reservations legitimately
  // belong to it and must NOT be released just because something later
  // (email, cart-clearing) throws.
  let orderCreated = false;
  const reservations = [];
  const releaseAll = async () => {
    for (const r of reservations) {
      try {
        await releaseStockReservation(r.inventoryId, r.quantity, r.variantId);
      } catch (releaseError) {
        console.error('Error releasing reservation during rollback:', releaseError);
      }
    }
  };

  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { shippingAddress, customerNotes, paymentMethod = 'cash_to_vendor' } = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key') || null;

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.phone || !shippingAddress.city || !shippingAddress.state) {
      return NextResponse.json(
        { success: false, message: "Complete shipping address is required" },
        { status: 400 }
      );
    }

    // Paystack requires an email to initialize a transaction -- not
    // otherwise a required field on this form for cash_to_vendor orders.
    if (paymentMethod === 'paystack' && !shippingAddress.email) {
      return NextResponse.json(
        { success: false, message: "Email address is required for online payment" },
        { status: 400 }
      );
    }

    // Idempotency short-circuit: a retried/double-clicked request with the
    // same key returns the order already created for it instead of
    // re-running reservation/creation (which would double-charge stock).
    if (idempotencyKey) {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, total_amount, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingOrder) {
        return NextResponse.json({
          success: true,
          message: "Order already created",
          order: orderSummary(existingOrder)
        });
      }
    }

    // Get cart with items
    const cart = await getOrCreateCart(customerId, true);

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cart is empty" },
        { status: 400 }
      );
    }

    // Phase 1: validate + atomically reserve stock for every item. Any
    // failure releases everything reserved so far and returns -- no order
    // is created until every item has cleared this phase.
    const orderItemsInput = [];
    const storeDataCache = new Map();

    // One batched lookup for every cart item's product instead of a query
    // per item -- the loop below reads from this map.
    const productIds = [...new Set(cart.items.map(item => item.product_id))];
    const products = await findInventoryByIds(productIds);
    const productById = new Map(products.map(p => [p.id, p]));

    for (const cartItem of cart.items) {
      const product = productById.get(cartItem.product_id);

      if (!product) {
        await releaseAll();
        return NextResponse.json(
          { success: false, message: `Product not found` },
          { status: 404 }
        );
      }

      if (!product.isActive) {
        await releaseAll();
        return NextResponse.json(
          { success: false, message: `Product ${product.productName} is not available` },
          { status: 400 }
        );
      }

      // The real variant identity lives at product_snapshot.variant (set
      // when the item was added to cart) -- cart_items has no top-level
      // `variant`/`batch_id` columns, so reading those directly (as this
      // route used to) always resolved to null and silently reserved
      // stock against the parent product instead of the chosen variant.
      const variant = cartItem.product_snapshot?.variant || null;
      const variantId = variant?.variant_id || null;

      let reserveResult;
      try {
        reserveResult = await reserveStock(cartItem.product_id, cartItem.quantity, variantId);
      } catch (stockError) {
        await releaseAll();
        return NextResponse.json(
          { success: false, message: `Insufficient stock for ${product.productName}: ${stockError.message}` },
          { status: 400 }
        );
      }

      reservations.push({ inventoryId: cartItem.product_id, variantId, quantity: cartItem.quantity });

      // Fetch complete store data if not cached
      if (!storeDataCache.has(cartItem.store_id)) {
        const storeData = await fetchStoreData(cartItem.store_id);
        storeDataCache.set(cartItem.store_id, storeData);
      }
      const completeStoreData = storeDataCache.get(cartItem.store_id);
      const firstBatch = reserveResult.batches?.[0];

      orderItemsInput.push({
        productId: cartItem.product_id,
        storeId: cartItem.store_id,
        quantity: cartItem.quantity,
        price: cartItem.price,
        subtotal: cartItem.subtotal,
        productSnapshot: cartItem.product_snapshot,
        storeSnapshot: completeStoreData ? {
          store_name: completeStoreData.store_name,
          storeName: completeStoreData.store_name,
          store_slug: completeStoreData.store_slug,
          storeSlug: completeStoreData.store_slug,
          store_phone: completeStoreData.store_phone,
          storePhone: completeStoreData.store_phone,
          store_email: completeStoreData.store_email,
          storeEmail: completeStoreData.store_email,
          address: completeStoreData.address,
          online_store_info: completeStoreData.online_store_info,
          onlineStoreInfo: completeStoreData.online_store_info,
          branding: completeStoreData.branding
        } : cartItem.store_snapshot,
        variantId,
        variantColor: variant?.color || null,
        variantSize: variant?.size || null,
        variantSku: variant?.sku || null,
        variantImage: variant?.image || null,
        batchId: firstBatch?.batch_id || null,
        batchCode: firstBatch?.batch_code || null,
        reservedBatches: reserveResult.batches || []
      });
    }

    // Calculate totals
    const subtotal = cart.subtotal;
    const totalAmount = cart.total;

    // Phase 2: every item reserved successfully -- create the order.
    let order;
    try {
      order = await createOrder({
        customerId,
        items: orderItemsInput,
        shippingAddress,
        subtotal,
        tax: cart.tax || 0,
        shippingFee: cart.shipping || 0,
        discount: cart.discount || 0,
        couponDiscount: cart.coupon_discount || 0,
        totalAmount,
        customerNotes,
        paymentMethod,
        orderSource: 'web',
        idempotencyKey
      });
    } catch (createError) {
      await releaseAll();
      console.error("Error creating order:", createError);
      return NextResponse.json(
        { success: false, message: "Failed to create order" },
        { status: 500 }
      );
    }

    // Lost an idempotency race: a concurrent request with the same key won
    // and already created the order. Our reservations are redundant.
    if (order._wasExistingOrder) {
      await releaseAll();
      return NextResponse.json({
        success: true,
        message: "Order already created",
        order: orderSummary(order)
      });
    }

    // The order now legitimately owns these reservations -- from here on,
    // failures must not release them (the outer catch checks this flag).
    orderCreated = true;

    // Record which batch(es) actually backed each order line, so
    // release/fulfillment later can target them precisely instead of
    // re-walking FIFO from scratch.
    try {
      const batchRows = [];
      order.order_items.forEach((insertedItem, idx) => {
        for (const b of orderItemsInput[idx].reservedBatches) {
          batchRows.push({
            order_item_id: insertedItem.id,
            batch_id: b.batch_id,
            batch_code: b.batch_code,
            quantity_reserved: b.quantity
          });
        }
      });
      if (batchRows.length > 0) {
        const { error: batchLogError } = await supabaseAdmin.from('order_item_batches').insert(batchRows);
        if (batchLogError) console.error('Error recording order_item_batches:', batchLogError);
      }
    } catch (batchLogError) {
      console.error('Error recording order_item_batches (non-fatal):', batchLogError);
    }

    // Clear cart
    await clearCart(cart);

    // Single source of truth for per-store subtotals -- feeds both the
    // payment split below and the notification/email loop, so they can
    // never disagree about what each vendor is owed.
    const storeGroupedItems = await groupOrderItemsByStore(order);

    let paymentSplitResult = null;
    let paymentSplitError = null;
    if (paymentMethod === 'paystack') {
      try {
        paymentSplitResult = await computePaymentSplit(order, storeGroupedItems);
      } catch (splitError) {
        console.error('Error computing payment split:', splitError);
        paymentSplitError = 'Failed to set up payment for this order. Please try again.';
      }
    }

    // Send email notifications to store owners
    try {
      // Create an in-app notification for each store owner -- this is what
      // the dashboard's Realtime SSE relay (apps/dashboard/src/app/api/notifications/stream/route.js)
      // picks up live. Isolated in its own try/catch so a failure here never
      // blocks the email loop below (or order creation, per the outer catch).
      try {
        const storeIds = Object.keys(storeGroupedItems);
        const { data: storeOwners } = await supabaseAdmin
          .from('stores')
          .select('id, owner_id')
          .in('id', storeIds);
        const ownerByStoreId = new Map((storeOwners || []).map(s => [s.id, s.owner_id]));

        const notificationRows = [];
        for (const [storeId, storeData] of Object.entries(storeGroupedItems)) {
          const ownerId = ownerByStoreId.get(storeId);
          if (!ownerId) continue;

          const itemCount = storeData.items.reduce((sum, item) => sum + item.quantity, 0);
          notificationRows.push({
            user_id: ownerId,
            title: 'New order received',
            message: `Order ${order.order_number} - ${itemCount} item${itemCount === 1 ? '' : 's'}, ₦${Number(storeData.total).toLocaleString('en-NG')}`,
            type: 'order',
            related_entity_type: 'order',
            related_entity_id: order.id,
            data: {
              orderId: order.id,
              orderNumber: order.order_number,
              storeTotal: storeData.total,
              itemCount
            }
          });
        }

        if (notificationRows.length > 0) {
          const { error: notifyError } = await supabaseAdmin.from('notifications').insert(notificationRows);
          if (notifyError) console.error('Error inserting order notifications:', notifyError);
        }
      } catch (notifyError) {
        console.error('Error creating order notifications (non-fatal):', notifyError);
      }

      // Send email to each store
      for (const [storeId, storeData] of Object.entries(storeGroupedItems)) {
        const storeEmail = storeData.store?.store_email;

        if (storeEmail) {
          const emailData = {
            _id: order.id,
            orderNumber: order.order_number,
            customerSnapshot: {
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              phone: shippingAddress.phone
            },
            shippingAddress,
            customerNotes,
            storeItems: storeData.items,
            storeTotal: storeData.total,
            storeItemCount: storeData.items.reduce((sum, item) => sum + item.quantity, 0)
          };

          await sendNewOrderNotification(
            storeEmail,
            storeData.store.store_name,
            emailData
          );

          console.log(`Order notification email sent to ${storeData.store.store_name} (${storeEmail})`);
        }
      }
    } catch (emailError) {
      console.error("Error sending order notification emails:", emailError);
    }

    // contactOnlyStores carries what the frontend needs to show the
    // existing WhatsApp-contact fallback, scoped to just these vendors
    // (see apps/store/src/app/[slug]/cart/page.js) -- stores with no
    // Paystack subaccount configured yet, or the whole cart when
    // paymentMethod isn't 'paystack' at all.
    const contactOnlyStoreIds = paymentSplitResult?.contactOnlyStoreIds
      ?? (paymentMethod === 'paystack' ? [] : Object.keys(storeGroupedItems));
    const contactOnlyStores = contactOnlyStoreIds.map(storeId => {
      const groupData = storeGroupedItems[storeId];
      return {
        storeId,
        // storeSnapshot is the raw order_stores row -- WhatsAppContactModal's
        // getAvailableSocialMedia() reads store.storeSnapshot?.whatsapp etc.
        // directly from it (flat fields on order_stores, not nested).
        storeSnapshot: groupData?.store,
        storeName: groupData?.store?.store_name,
        storePhone: groupData?.store?.store_phone,
        itemCount: groupData?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        total: groupData?.total
      };
    });

    return NextResponse.json({
      success: true,
      message: "Order created successfully",
      order: orderSummary(order),
      paymentRequired: Boolean(paymentSplitResult?.payableStoreIds?.length),
      paymentSplitError,
      contactOnlyStores
    });

  } catch (error) {
    // Only release reservations if the order itself was never created --
    // once it exists, these reservations legitimately belong to it, and a
    // later failure (email, cart-clearing) must not undo them.
    if (!orderCreated) {
      await releaseAll();
    }
    console.error("Error creating order:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create order", error: error.message },
      { status: 500 }
    );
  }
}
