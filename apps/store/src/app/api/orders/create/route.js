import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyCustomerSession } from "@/lib/auth";
import { sendStoreOrderNotifications } from "@/lib/orderNotifications";
import { createOrder, reserveStock, releaseStockReservation } from "@/lib/supabaseOrders";
import { getOrCreateCart, clearCart, removeItemsFromCart } from "@/lib/supabaseCart";
import { findInventoryByIds, findActiveBatchesByInventoryIds, resolveBatchPricing } from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidNigerianState } from "@stora/shared-constants";

const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.02');
// A flat 2% is too thin to be worth collecting on small orders (Paystack's
// own per-transaction fee alone can exceed it) -- floor Stora's take
// regardless of order size.
const PLATFORM_MINIMUM_COMMISSION = parseFloat(process.env.PLATFORM_MINIMUM_COMMISSION || '200');

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
    const rateBasedCommission = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
    // Floored at PLATFORM_MINIMUM_COMMISSION, but never above grossAmount
    // itself -- without that cap, an item priced under NGN200 would push
    // netAmount negative below in 'vendor'-bearer mode (Stora can't take
    // more commission than the order is actually worth).
    const commissionAmount = Math.min(Math.max(rateBasedCommission, PLATFORM_MINIMUM_COMMISSION), grossAmount);
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
        await releaseStockReservation(r.variantId, r.quantity);
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
    if (!isValidNigerianState(shippingAddress.state)) {
      return NextResponse.json(
        { success: false, message: "Not a valid Nigerian state" },
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

    // Everything below is a read with no cross-dependency on the others --
    // the pending-order conflict check, the deliverability check, and the
    // product/batch lookups needed for Phase 1 -- so they run as one round
    // trip's worth of latency instead of four sequential ones. None of them
    // mutate anything, so there's nothing to unwind if a later one fails;
    // the (rare) cost is a wasted product/batch fetch on the failure path,
    // traded for a real latency win on the common (success) path.
    const pendingOrderIds = [...new Set(itemsToProcess.map(item => item.pending_order_id).filter(Boolean))];
    const checkoutStoreIds = [...new Set(itemsToProcess.map(item => item.store_id))];
    const productIds = [...new Set(itemsToProcess.map(item => item.product_id))];

    const [liveOrders, checkoutStores, products, batchesByProduct] = await Promise.all([
      pendingOrderIds.length > 0
        ? supabaseAdmin.from('orders').select('id, order_number').in('id', pendingOrderIds).not('status', 'in', '(cancelled,refunded)').then(r => r.data)
        : Promise.resolve(null),
      supabaseAdmin.from('stores').select('id, store_name, delivery_states').in('id', checkoutStoreIds).then(r => r.data),
      findInventoryByIds(productIds),
      findActiveBatchesByInventoryIds(productIds)
    ]);

    // Block re-checking-out an item that's already tied to a still-unpaid
    // order. Cart items now stay in the cart (flagged via pending_order_id)
    // while their payment is unresolved instead of being cleared at order
    // creation -- see the cart-handling block below -- so without this
    // guard, a customer could reserve stock twice for the same item by
    // just clicking "place order" again before the first attempt resolves.
    if (liveOrders && liveOrders.length > 0) {
      return NextResponse.json({
        success: false,
        message: `You already have an order (${liveOrders[0].order_number}) awaiting payment for one or more of these items. Complete or cancel that payment first.`,
        existingOrderId: liveOrders[0].id
      }, { status: 409 });
    }

    // Deliverability check -- runs before anything is reserved, so a
    // rejection here needs no compensating rollback (unlike a mid-Phase-1
    // failure, which does). The client-side dropdown in OrderModal.js
    // already filters to deliverable states, but that's trivially
    // bypassable (a direct POST here, or a stale dropdown selection), so
    // this is the actual enforcement point.
    const undeliverableStores = (checkoutStores || []).filter(store => {
      const states = store.delivery_states;
      return states && states.length > 0 && !states.includes(shippingAddress.state);
    });
    if (undeliverableStores.length > 0) {
      const names = undeliverableStores.map(s => s.store_name).join(', ');
      return NextResponse.json({
        success: false,
        message: `${names} ${undeliverableStores.length === 1 ? "doesn't" : "don't"} deliver to ${shippingAddress.state}. Remove ${undeliverableStores.length === 1 ? 'their items' : 'those items'} or choose a different delivery state.`
      }, { status: 400 });
    }

    // Phase 1: validate every item first (no DB calls -- product/batches
    // are already fetched above, and resolveBatchPricing is pure
    // computation over that data), then reserve stock for every item that
    // passed, in parallel. Validating everything up front means a rejected
    // item costs zero reservations/rollbacks, instead of releasing
    // whatever the sequential loop had already reserved before hitting it.
    const productById = new Map(products.map(p => [p.id, p]));
    const validated = [];
    for (const cartItem of itemsToProcess) {
      const product = productById.get(cartItem.product_id);

      if (!product) {
        return NextResponse.json(
          { success: false, message: `Product not found` },
          { status: 404 }
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          { success: false, message: `Product ${product.productName} is not available` },
          { status: 400 }
        );
      }

      // The real variant identity lives at product_snapshot.variant (set
      // when the item was added to cart -- see supabaseCart.js's
      // prepareCartItemData, which now always resolves one, even for a
      // simple product with no real size/color options). No fallback to
      // null: every product has >=1 real variant row
      // (20260817000001_unify_inventory_variants.sql), so a cart item
      // with no resolved variant_id is stale pre-migration data, not a
      // legitimate state to silently proceed on.
      const variant = cartItem.product_snapshot?.variant || null;
      const variantId = variant?.variant_id || null;
      if (!variantId) {
        return NextResponse.json(
          { success: false, message: `${product.productName} needs to be re-added to your cart before checkout.` },
          { status: 400 }
        );
      }

      // Price re-validation: checkout has always charged whatever price
      // was snapshotted into the cart at add-to-cart time, with no check
      // against the current price -- a vendor repricing (or a batch
      // rotating) mid-session meant the customer could be charged a
      // stale number with no defense. Reject and ask them to review
      // their cart rather than either silently honoring the old price or
      // silently charging the new one without their awareness.
      const currentBatches = (batchesByProduct[cartItem.product_id] || []).filter(b => b.variant_id === variantId);
      const { sellingPrice: currentPrice } = await resolveBatchPricing(product, currentBatches, variantId);
      if (parseFloat(currentPrice) !== parseFloat(cartItem.price)) {
        return NextResponse.json(
          {
            success: false,
            message: `The price of ${product.productName} has changed (was ₦${parseFloat(cartItem.price).toLocaleString('en-NG')}, now ₦${parseFloat(currentPrice).toLocaleString('en-NG')}). Please review your cart before checking out.`,
            priceChanged: true,
            productId: cartItem.product_id,
            oldPrice: parseFloat(cartItem.price),
            newPrice: parseFloat(currentPrice)
          },
          { status: 409 }
        );
      }

      validated.push({ cartItem, product, variant, variantId });
    }

    // Every distinct store's full record, fetched once each in parallel --
    // replaces the old per-item "fetch if not already cached" pattern,
    // which still awaited each new store's fetch inline in loop order.
    const uniqueStoreIds = [...new Set(validated.map(v => v.cartItem.store_id))];
    const storeDataList = await Promise.all(uniqueStoreIds.map(id => fetchStoreData(id)));
    const storeDataById = new Map(uniqueStoreIds.map((id, i) => [id, storeDataList[i]]));

    // Reserve stock for every validated item in parallel -- each is an
    // atomic RPC call (fn_reserve_stock) scoped to its own variant_id row,
    // so concurrent calls are safe even in the (unexpected) case two items
    // share a variant: Postgres's own row locking serializes those two
    // specific calls, it just no longer costs every *other* item a
    // sequential round trip while it does.
    const settlements = await Promise.allSettled(
      validated.map(({ variantId, cartItem }) => reserveStock(variantId, cartItem.quantity))
    );

    const firstFailureIndex = settlements.findIndex(s => s.status === 'rejected');
    if (firstFailureIndex !== -1) {
      // Release whatever DID succeed -- unlike the old sequential loop,
      // a failure here doesn't mean "only what came before it reserved,"
      // it means "some subset across the whole batch reserved," so every
      // fulfilled settlement needs releasing, not just the earlier ones.
      settlements.forEach((s, i) => {
        if (s.status === 'fulfilled') {
          reservations.push({ variantId: validated[i].variantId, quantity: validated[i].cartItem.quantity });
        }
      });
      await releaseAll();
      const failedProduct = validated[firstFailureIndex].product;
      const failureError = settlements[firstFailureIndex].reason;
      return NextResponse.json(
        { success: false, message: `Insufficient stock for ${failedProduct.productName}: ${failureError.message}` },
        { status: 400 }
      );
    }

    const orderItemsInput = validated.map(({ cartItem, product, variant, variantId }, i) => {
      const reserveResult = settlements[i].value;
      reservations.push({ variantId, quantity: cartItem.quantity });
      const completeStoreData = storeDataById.get(cartItem.store_id);
      const firstBatch = reserveResult.batches?.[0];

      return {
        productId: cartItem.product_id,
        storeId: cartItem.store_id,
        quantity: cartItem.quantity,
        price: cartItem.price,
        subtotal: cartItem.subtotal,
        notes: cartItem.notes || null,
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
      };
    });

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

    // Items belonging to a store with a pending online charge stay in the
    // cart, flagged via pending_order_id, instead of being removed now --
    // clearing is deferred to actual payment confirmation
    // (confirmOrderPayment in supabasePayments.js), and the flag is what
    // lets a second checkout attempt on the same item be detected and
    // blocked above instead of silently double-reserving stock. Anything
    // with no payment to wait for (contact-only stores, or the whole cart
    // when paymentMethod isn't 'paystack' at all) is removed immediately,
    // same as this route always did before payment was ever deferred.
    const payableStoreIdSet = new Set(paymentSplitResult?.payableStoreIds || []);
    const pendingItems = itemsToProcess.filter(item => payableStoreIdSet.has(item.store_id));
    const settledItems = itemsToProcess.filter(item => !payableStoreIdSet.has(item.store_id));

    if (pendingItems.length > 0) {
      const { error: flagError } = await supabaseAdmin
        .from('cart_items')
        .update({ pending_order_id: order.id })
        .in('id', pendingItems.map(item => item.id));
      if (flagError) console.error('Error flagging cart items as payment-pending:', flagError);
    }

    if (settledItems.length > 0) {
      if (isScopedCheckout || pendingItems.length > 0) {
        // Scoped checkout, or a mixed cart where some items are still
        // payment-pending -- remove exactly what's settled, never touch
        // the rest of the cart.
        await removeItemsFromCart(cart, settledItems.map(item => item.id));
      } else {
        // Whole-cart checkout with nothing left pending -- same full reset
        // this route always did.
        await clearCart(cart);
      }
    }

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
