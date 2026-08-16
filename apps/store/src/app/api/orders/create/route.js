import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyCustomerSession } from "@/lib/auth";
import { sendStoreOrderNotifications } from "@/lib/orderNotifications";
import { createOrder, reserveStock, releaseStockReservation } from "@/lib/supabaseOrders";
import { getOrCreateCart, clearCart, removeItemsFromCart } from "@/lib/supabaseCart";
import { findInventoryByIds } from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";

const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.02');

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
    .select('id, paystack_ready, bank_details, commission_bearer')
    .in('id', storeIds);

  if (storesError) throw storesError;

  const readyStoreIds = new Set((stores || []).filter(s => s.paystack_ready).map(s => s.id));
  const subaccountByStoreId = new Map(
    (stores || []).map(s => [s.id, s.bank_details?.paystack_subaccount_code])
  );
  const commissionBearerByStoreId = new Map(
    (stores || []).map(s => [s.id, s.commission_bearer === 'customer' ? 'customer' : 'vendor'])
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
  // Sum of what's actually charged to the customer across every payable
  // store -- NOT a sum of gross amounts, since a 'customer'-bearer store
  // adds its commission on top (see below). This is what Paystack is
  // actually asked to collect (order_payments.amount, further down).
  let payableSubtotal = 0;

  for (const storeId of payableStoreIds) {
    const grossAmount = storeGroupedItems[storeId].total;
    const commissionAmount = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
    const bearer = commissionBearerByStoreId.get(storeId);

    // Snapshotted per split at checkout time -- a vendor flipping their
    // toggle later must not retroactively change an already-placed order.
    // netAmount is "what the vendor keeps" either way: gross minus
    // commission when the vendor bears it, the full gross when the
    // customer does (since the customer's extra payment covers it
    // instead). It's also -- by the "commission is never refunded to
    // anyone" policy applied consistently in both directions -- exactly
    // the correct refundable ceiling in both modes too, which is why the
    // refund route needs no changes for this feature.
    const netAmount = bearer === 'customer' ? grossAmount : grossAmount - commissionAmount;
    const customerAmount = bearer === 'customer' ? grossAmount + commissionAmount : grossAmount;
    payableSubtotal += customerAmount;

    splitRows.push({
      id: crypto.randomUUID(),
      order_id: order.id,
      order_payment_id: orderPayment.id,
      store_id: storeId,
      subaccount_code: subaccountByStoreId.get(storeId),
      gross_amount: grossAmount,
      platform_commission_rate: PLATFORM_COMMISSION_RATE,
      platform_commission_amount: commissionAmount,
      net_amount_to_vendor: netAmount,
      commission_bearer: bearer,
      customer_amount: customerAmount
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

    // itemIds, when present, scopes this checkout to a subset of the
    // cart (the cart page's per-store "Place order" buttons send just
    // that store's item ids) -- absent, the whole cart is checked out as
    // one order, same as always. cartId is accepted but not needed: the
    // customer's own cart is always looked up from their session below,
    // never trusted from the client.
    const { shippingAddress, customerNotes, paymentMethod = 'cash_to_vendor', itemIds } = await request.json();
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

    // Scope to just the requested items when itemIds is given -- cart.items
    // is already scoped to this customer's own cart (getOrCreateCart keys
    // off their session), so filtering it down is safe regardless of what
    // ids were sent; there's no cross-customer id to leak here.
    const isScopedCheckout = Array.isArray(itemIds) && itemIds.length > 0;
    let itemsToProcess = cart.items;
    if (isScopedCheckout) {
      const requestedIds = new Set(itemIds);
      itemsToProcess = cart.items.filter(item => requestedIds.has(item.id));
      if (itemsToProcess.length === 0) {
        return NextResponse.json(
          { success: false, message: "The selected items are no longer in your cart" },
          { status: 400 }
        );
      }
    }

    // Phase 1: validate + atomically reserve stock for every item. Any
    // failure releases everything reserved so far and returns -- no order
    // is created until every item has cleared this phase.
    const orderItemsInput = [];
    const storeDataCache = new Map();

    // One batched lookup for every cart item's product instead of a query
    // per item -- the loop below reads from this map.
    const productIds = [...new Set(itemsToProcess.map(item => item.product_id))];
    const products = await findInventoryByIds(productIds);
    const productById = new Map(products.map(p => [p.id, p]));

    for (const cartItem of itemsToProcess) {
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

    // Calculate totals. For a scoped (per-store) checkout this is
    // recomputed from just the items being ordered -- cart.subtotal/total
    // are whole-cart aggregates and would incorrectly include whatever's
    // left behind. Tax/shipping/discount/coupon are cart-level fields with
    // no defined per-item split, so a scoped checkout deliberately doesn't
    // carry them over (they only apply to the whole-cart checkout path).
    const subtotal = isScopedCheckout
      ? itemsToProcess.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0)
      : cart.subtotal;
    const totalAmount = isScopedCheckout ? subtotal : cart.total;

    // Phase 2: every item reserved successfully -- create the order.
    let order;
    try {
      order = await createOrder({
        customerId,
        items: orderItemsInput,
        shippingAddress,
        subtotal,
        tax: isScopedCheckout ? 0 : (cart.tax || 0),
        shippingFee: isScopedCheckout ? 0 : (cart.shipping || 0),
        discount: isScopedCheckout ? 0 : (cart.discount || 0),
        couponDiscount: isScopedCheckout ? 0 : (cart.coupon_discount || 0),
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

    // Scoped checkout only removes the items just ordered, leaving
    // whatever else was in the cart (e.g. another store's items) intact
    // for a later checkout -- a blanket clearCart here would silently
    // drop items the customer never asked to check out yet.
    if (isScopedCheckout) {
      await removeItemsFromCart(cart, itemsToProcess.map(item => item.id));
    } else {
      await clearCart(cart);
    }

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

    // contactOnlyStores carries what the frontend needs to show the
    // existing WhatsApp-contact fallback, scoped to just these vendors
    // (see apps/store/src/app/[slug]/cart/page.js) -- stores with no
    // Paystack subaccount configured yet, or the whole cart when
    // paymentMethod isn't 'paystack' at all.
    // If the split itself failed, the customer still needs a way forward --
    // fall back to treating every store as contact-only (same as a
    // non-paystack order), rather than leaving paymentRequired true with no
    // usable path (see paymentSplitError below).
    const contactOnlyStoreIds = paymentSplitError
      ? Object.keys(storeGroupedItems)
      : (paymentSplitResult?.contactOnlyStoreIds ?? (paymentMethod === 'paystack' ? [] : Object.keys(storeGroupedItems)));

    // Notify only the contact-only stores now -- no online payment gates
    // them, so this is the same immediate notification the cash_to_vendor
    // flow has always had. Stores actually covered by a pending Paystack
    // charge are deliberately NOT notified here: they're notified only
    // once confirmOrderPayment() confirms the charge actually went through
    // (see apps/store/src/lib/supabasePayments.js) -- a vendor told about
    // an order before the customer has paid for it is being told about an
    // order that might never really happen.
    try {
      await sendStoreOrderNotifications(
        { orderId: order.id, orderNumber: order.order_number, shippingAddress, customerNotes },
        storeGroupedItems,
        contactOnlyStoreIds
      );
    } catch (notifyError) {
      console.error("Error sending order notifications:", notifyError);
    }

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
