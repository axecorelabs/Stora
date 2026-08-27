import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// GET - Fetch specific order by ID
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // First get the user's store
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json(
        { success: false, message: 'Store not found' },
        { status: 404 }
      );
    }

    // orders is multi-vendor: an order can contain items from several stores,
    // so permission is scoped through order_items.store_id, not orders.store_id
    // (orders has no store_id column).
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .eq('store_id', store.id);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    const [{ data: customer }, { data: addresses }, { data: payment }, { data: timeline }, { data: allStoreLinks }, { data: split }] = await Promise.all([
      supabaseAdmin.from('order_customers').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_addresses').select('*').eq('order_id', id),
      supabaseAdmin.from('order_payments').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_timeline').select('*').eq('order_id', id).order('timestamp', { ascending: true }),
      // Every store's id on this order (not item-level detail) -- used only
      // to detect a multi-vendor order, since shipping/tax/discount/total
      // are tracked once per order, not itemized per-store, and would
      // otherwise misattribute other vendors' portions to this one.
      supabaseAdmin.from('order_items').select('store_id').eq('order_id', id),
      // This vendor's own split row -- carries their resolved
      // delivery_fee_amount/fulfillment_method (see computePaymentSplit in
      // apps/store/src/app/api/orders/create/route.js). No row exists for
      // a cash_to_vendor order or a contact-only (no subaccount) store --
      // both already off the structured-payment path entirely, so the
      // 0/'platform_collected' fallbacks below are correct, not a gap.
      supabaseAdmin.from('order_payment_splits').select('id, delivery_fee_amount, fulfillment_method, net_amount_to_vendor, platform_commission_amount, status, refunded_amount').eq('order_id', id).eq('store_id', store.id).maybeSingle()
    ]);

    const shippingAddr = (addresses || []).find(a => a.address_type === 'shipping') || {};
    const billingAddr = (addresses || []).find(a => a.address_type === 'billing') || {};
    const isMultiVendor = new Set((allStoreLinks || []).map(l => l.store_id)).size > 1;
    const vendorItemsSubtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

    // Same shape /api/orders (the list endpoint) already builds -- this
    // route was returning the raw order_items rows as-is (flat
    // product_name/product_image/... columns, no nested productSnapshot),
    // while OrderDetailsContent.js unconditionally reads
    // item.productSnapshot.image/.productName for every item. That's safe
    // on the list endpoint's shape and throws on this one -- exactly what
    // happened once the refund feature's refetch-for-refundSplit effect
    // started swapping this endpoint's data into an already-open modal
    // shortly after it opened, not just after a status update.
    const transformedItems = items.map(item => ({
      ...item,
      _id: item.product_id,
      product_id: item.product_id,
      productName: item.product_name,
      sku: item.product_sku,
      sellingPrice: item.unit_price,
      productSnapshot: {
        productName: item.product_name || 'Unknown Product',
        sku: item.product_sku,
        image: item.product_image,
        category: item.product_category
      },
      variant: {
        color: item.variant_color,
        size: item.variant_size,
        image: item.variant_image
      },
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
      status: item.item_status,
      notes: item.notes || null
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        // Camelcase to match /api/orders (the list endpoint) exactly --
        // OrderDetailsModal is only ever fed by one of these two endpoints
        // depending on whether it just opened (list) or just refreshed
        // after a status update (this one). Returning a different field
        // naming convention here silently blanked the order summary
        // (total/shipping/order number/item count) the moment a vendor
        // updated an order's status, since ...order alone only carries the
        // raw snake_case columns.
        orderNumber: order.order_number,
        customerSnapshot: {
          firstName: customer?.first_name || 'Guest',
          lastName: customer?.last_name || 'Customer',
          email: customer?.email || '',
          phone: customer?.phone || ''
        },
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        paymentInfo: payment || {},
        items: transformedItems,
        itemCount: items.length,
        timeline: timeline || [],
        isMultiVendor,
        subtotal: isMultiVendor ? vendorItemsSubtotal : (order.subtotal || 0),
        // Sourced from this vendor's own order_payment_splits row, not
        // order.shipping_fee (an order-wide total across every vendor) --
        // correct for single- and multi-vendor orders alike, since a split
        // row is always per-(order, store). Only counted here when
        // platform_collected -- this feeds the "Shipping" line in the
        // paid-breakdown UI, which would misrepresent a pay_on_delivery fee
        // as money already collected; that amount is exposed separately
        // below instead.
        shippingFee: split?.fulfillment_method === 'pay_on_delivery' ? 0 : (Number(split?.delivery_fee_amount) || 0),
        deliveryFulfillmentMethod: split?.fulfillment_method === 'pay_on_delivery' ? 'pay_on_delivery' : 'platform_collected',
        // What this vendor should expect from the customer/rider directly
        // on arrival -- never part of the Paystack settlement, so it's
        // deliberately not folded into shippingFee/totalAmount above.
        payOnDeliveryFee: split?.fulfillment_method === 'pay_on_delivery' ? (Number(split?.delivery_fee_amount) || 0) : 0,
        // This vendor's own payment_splits row, for the Refund modal --
        // absent for a cash_to_vendor order or a contact-only store (no
        // structured payment exists to refund).
        refundSplit: split ? {
          id: split.id,
          netAmountToVendor: Number(split.net_amount_to_vendor) || 0,
          platformCommissionAmount: Number(split.platform_commission_amount) || 0,
          status: split.status,
          refundedAmount: Number(split.refunded_amount) || 0
        } : null,
        discount: isMultiVendor ? 0 : (order.discount || 0),
        tax: isMultiVendor ? 0 : (order.tax || 0),
        totalAmount: isMultiVendor ? vendorItemsSubtotal : order.total_amount
      }
    });

  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
