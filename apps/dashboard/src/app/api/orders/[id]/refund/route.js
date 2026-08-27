import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { releaseItemsReservation } from '@/lib/batchInventory';
import { sendRefundCustomerEmail, sendRefundVendorEmail } from '@/lib/email';

// Items in either of these states already had real stock deducted (see
// batchInventory.js's processItemsWithBatchTracking, run when an order is
// marked delivered) -- only these are eligible for the vendor's "restock"
// choice. Everything earlier only ever reserved stock, so it's released
// automatically below, never restocked (there's nothing to add back).
const FULFILLED_ITEM_STATUSES = ['shipped', 'delivered'];

// POST - Record a refund for a vendor's own share of a (possibly
// multi-vendor) paid order. This is deliberately bookkeeping-only: it
// does NOT call Paystack's refund API. Disputes are now handled offline
// by customer service, who arrange the actual money movement themselves
// (which may or may not go through Paystack) -- this action exists so
// that once that's settled, someone can mark it here and have the order,
// its payment record, and every dashboard view that reads order status
// (orders list, order detail) reflect it accurately for accounting.
// Vendor-scoped, not platform-admin-only -- consistent with how order
// management is already store-scoped everywhere else in this app (see
// the sibling status route). A live-Paystack-refund capability still
// exists (apps/dashboard/src/lib/paystack.js's refundTransaction) for
// whatever internal tooling customer service actually uses -- it's just
// not called from this vendor-facing action anymore.
export async function POST(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const { amount, note, restockItemIds } = await req.json().catch(() => ({}));

    if (!note || !note.trim()) {
      return NextResponse.json({ success: false, message: 'A reason is required to record a refund' }, { status: 400 });
    }

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, store_email')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
    }

    // Same ownership check as the status route -- confirms this vendor
    // actually has items on this order before it does anything else. Now
    // also carries what the restock/reservation-release logic below needs
    // per item, instead of just the id.
    const { data: storeItems } = await supabaseAdmin
      .from('order_items')
      .select('id, quantity, product_id, variant_id, variant_size, variant_color, item_status, product_name')
      .eq('order_id', id)
      .eq('store_id', store.id);

    if (!storeItems || storeItems.length === 0) {
      return NextResponse.json({ success: false, message: 'Order not found or access denied' }, { status: 404 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('order_number')
      .eq('id', id)
      .single();

    const { data: orderPayment, error: paymentError } = await supabaseAdmin
      .from('order_payments')
      .select('*')
      .eq('order_id', id)
      .single();

    if (paymentError || !orderPayment || orderPayment.provider !== 'paystack') {
      return NextResponse.json({ success: false, message: 'This order has no online payment to refund' }, { status: 400 });
    }

    if (!['completed', 'partially_refunded'].includes(orderPayment.status)) {
      return NextResponse.json({ success: false, message: 'This payment has not been completed yet' }, { status: 400 });
    }

    const { data: split, error: splitError } = await supabaseAdmin
      .from('order_payment_splits')
      .select('*')
      .eq('order_payment_id', orderPayment.id)
      .eq('store_id', store.id)
      .single();

    if (splitError || !split) {
      return NextResponse.json({ success: false, message: 'No payment record found for your store on this order' }, { status: 404 });
    }

    if (split.status === 'reversed') {
      return NextResponse.json({ success: false, message: 'This has already been refunded' }, { status: 400 });
    }

    // Policy: the platform commission is non-refundable -- retained
    // regardless of whether this is a partial or full refund. So the
    // actual refundable ceiling for this vendor's split is
    // net_amount_to_vendor (what the customer's payment becomes once the
    // commission is set aside), not the full gross_amount they paid.
    const netAmount = parseFloat(split.net_amount_to_vendor);
    const commissionAmount = parseFloat(split.platform_commission_amount);
    const refundAmount = amount != null ? Math.min(parseFloat(amount), netAmount) : netAmount;
    if (!(refundAmount > 0)) {
      return NextResponse.json({ success: false, message: 'Invalid refund amount' }, { status: 400 });
    }
    const isFullRefund = refundAmount >= netAmount;
    const now = new Date().toISOString();

    // The status===‘reversed’ check above is only a courtesy early-exit --
    // it reads a snapshot, so two requests racing on the same split could
    // both pass it before either commits. The real guard is this update's
    // own WHERE clause: an UPDATE ... WHERE status != 'reversed' is atomic
    // at the row level (Postgres locks the row for the statement's
    // duration), so only one concurrent request can ever actually flip it.
    // Whichever loses the race gets zero rows back and bails out here,
    // before touching order_payments, restock, or anything else below --
    // same single-plain-set semantics as before, just race-safe now.
    const { data: reversedSplit, error: reverseError } = await supabaseAdmin
      .from('order_payment_splits')
      .update({ status: 'reversed', refunded_amount: refundAmount, updated_at: now })
      .eq('id', split.id)
      .neq('status', 'reversed')
      .select('id')
      .maybeSingle();

    if (reverseError || !reversedSplit) {
      return NextResponse.json({ success: false, message: 'This has already been refunded' }, { status: 400 });
    }

    // order_payments.status must reflect how much money has actually been
    // refunded, not how many vendor splits have had their (single, v1)
    // refund action used -- a split marked 'reversed' by a partial refund
    // isn't the same thing as the order being fully refunded. Comparing
    // cumulative refund_amount against the order's total collected amount
    // is what's actually accurate for accounting -- except that ceiling
    // now has to exclude every vendor's non-refundable commission too, or
    // an order could never reach 'refunded' (every split's refund is
    // capped below its gross_amount, so the cumulative sum would never
    // reach a gross-amount-based total on a commission-bearing order).
    const { data: allSplitsForPayment } = await supabaseAdmin
      .from('order_payment_splits')
      .select('net_amount_to_vendor')
      .eq('order_payment_id', orderPayment.id);
    const maxRefundableForOrder = (allSplitsForPayment || [])
      .reduce((sum, s) => sum + parseFloat(s.net_amount_to_vendor), 0);

    const newRefundAmount = parseFloat(orderPayment.refund_amount || 0) + refundAmount;
    const isOrderFullyRefunded = newRefundAmount >= maxRefundableForOrder;
    const newPaymentStatus = isOrderFullyRefunded ? 'refunded' : 'partially_refunded';

    await supabaseAdmin
      .from('order_payments')
      .update({
        status: newPaymentStatus,
        refund_amount: newRefundAmount,
        refunded_at: now,
        updated_at: now
      })
      .eq('id', orderPayment.id);

    if (isOrderFullyRefunded) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'refunded', updated_at: now })
        .eq('id', id);
    }

    // Reservation release + restock, scoped to this vendor's own items only.
    // Items that never reached shipped/delivered only ever had stock
    // reserved (see batchInventory.js), never actually deducted -- release
    // that reservation unconditionally, since refunding an order that was
    // never fulfilled should never leave stock locked up forever (today,
    // only order *cancellation* released it, which this refund action isn't
    // guaranteed to also trigger).
    const unfulfilledItems = storeItems.filter(item => !FULFILLED_ITEM_STATUSES.includes(item.item_status));
    if (unfulfilledItems.length > 0) {
      try {
        await releaseItemsReservation(
          unfulfilledItems.map(item => ({
            inventoryId: item.product_id,
            quantity: item.quantity,
            variant: (item.variant_size || item.variant_color)
              ? { size: item.variant_size, color: item.variant_color, variantId: item.variant_id }
              : null
          }))
        );
      } catch (releaseError) {
        console.error('Error releasing reservation on refund (non-fatal):', releaseError);
      }
    }

    // Restock only ever applies to a fulfilled item the vendor explicitly
    // confirmed is back and sellable -- a brand-new batch each time, since
    // there's no way to know which original batch a returned unit came
    // from (mirrors inventory/[id]/stock/route.js's own new-batch branch).
    const restockableIds = new Set((restockItemIds || []));
    const itemsToRestock = storeItems.filter(item => restockableIds.has(item.id) && FULFILLED_ITEM_STATUSES.includes(item.item_status));
    const restockedItemNames = [];
    const restockedIds = new Set();
    // Surfaced back in the response (and shown to the vendor) rather than
    // silently swallowed -- a vendor who checks "restock" and gets a
    // success response should never be left thinking stock was added back
    // when it silently wasn't (e.g. a legacy order item with no variant_id
    // on file, predating the "every product has exactly one variant"
    // migration).
    const restockFailures = [];

    for (const item of itemsToRestock) {
      if (!item.variant_id) {
        restockFailures.push(item.product_name);
        continue;
      }
      const { data: variant } = await supabaseAdmin
        .from('inventory_variants')
        .select('cost_price, price')
        .eq('id', item.variant_id)
        .single();
      if (!variant) {
        restockFailures.push(item.product_name);
        continue;
      }

      const { error: batchError } = await supabaseAdmin.rpc('fn_create_batch', {
        p_variant_id: item.variant_id,
        p_user_id: user.id,
        p_batch_code: `RFND-${now.slice(0, 10).replace(/-/g, '')}-${item.id.slice(0, 8)}`,
        p_quantity_in: item.quantity,
        p_cost_price: variant.cost_price || 0,
        p_selling_price: variant.price || 0,
        p_notes: `Restocked from refund on order #${order?.order_number || id}`,
        p_reason: 'refund_restock'
      });
      if (batchError) {
        console.error('Error restocking refunded item (non-fatal):', batchError);
        restockFailures.push(item.product_name);
        continue;
      }
      restockedItemNames.push(item.product_name);
      restockedIds.add(item.id);
    }

    // item_status reflects what actually happened to each line item, not
    // just the payment split -- restocked items are 'returned' regardless
    // of full/partial; everything else only moves to 'refunded' on a full
    // refund, since a partial refund's items are otherwise ambiguous (which
    // item does a bare currency amount correspond to?). restockedIds is
    // built above from items fn_create_batch actually succeeded for, not
    // from itemsToRestock (the candidate list) -- an item that failed to
    // restock (see restockFailures above) never actually came back into
    // stock, so it has no business being marked 'returned' either.
    for (const item of storeItems) {
      const nextStatus = restockedIds.has(item.id) ? 'returned' : (isFullRefund ? 'refunded' : null);
      if (!nextStatus || nextStatus === item.item_status) continue;
      await supabaseAdmin.from('order_items').update({ item_status: nextStatus }).eq('id', item.id);
    }

    // Audit trail -- same order_timeline table/shape the status route
    // already writes to, so this shows up alongside every other order
    // event in one place, with who recorded it and why. updated_by is a
    // role label (CHECK constraint: system/customer/admin/seller), not an
    // identity column -- the actual user goes in changed_by (a real FK).
    const { error: timelineError } = await supabaseAdmin.from('order_timeline').insert({
      order_id: id,
      status: newPaymentStatus,
      from_status: orderPayment.status,
      note: `${isFullRefund ? 'Full' : 'Partial'} refund of ₦${refundAmount.toLocaleString('en-NG')} recorded for ${store.store_name} (₦${commissionAmount.toLocaleString('en-NG')} platform fee retained, non-refundable): ${note.trim()}`,
      updated_by: 'seller',
      changed_by: user.id,
      timestamp: now
    });
    if (timelineError) {
      console.error('Error recording refund timeline entry (non-fatal):', timelineError);
    }

    // Deferred, best-effort notification emails -- never block the response
    // on SMTP round trips, same pattern as orders/[id]/status/route.js's own
    // post-write email trigger. Bookkeeping-only by design (see the module
    // comment above): these emails record that a refund was recorded, not
    // that money moved.
    const { data: orderCustomer } = await supabaseAdmin
      .from('order_customers')
      .select('email, first_name, last_name')
      .eq('order_id', id)
      .maybeSingle();

    after(async () => {
      const customerName = `${orderCustomer?.first_name || ''} ${orderCustomer?.last_name || ''}`.trim() || 'there';
      if (orderCustomer?.email) {
        try {
          await sendRefundCustomerEmail(orderCustomer.email, {
            orderNumber: order?.order_number || id,
            customerName,
            storeName: store.store_name,
            amount: refundAmount,
            isFullRefund
          });
        } catch (emailError) {
          console.error('Failed to send refund email to customer:', emailError);
        }
      }
      if (store.store_email) {
        try {
          await sendRefundVendorEmail(store.store_email, {
            orderNumber: order?.order_number || id,
            customerName,
            amount: refundAmount,
            isFullRefund,
            note: note.trim(),
            restockedItemNames
          });
        } catch (emailError) {
          console.error('Failed to send refund email to vendor:', emailError);
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: isFullRefund ? 'Refund recorded' : 'Partial refund recorded',
      refundAmount,
      orderPaymentStatus: newPaymentStatus,
      restockFailures
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
