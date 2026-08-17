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

    const [{ data: customer }, { data: addresses }, { data: payment }, { data: timeline }, { data: allStoreLinks }] = await Promise.all([
      supabaseAdmin.from('order_customers').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_addresses').select('*').eq('order_id', id),
      supabaseAdmin.from('order_payments').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_timeline').select('*').eq('order_id', id).order('timestamp', { ascending: true }),
      // Every store's id on this order (not item-level detail) -- used only
      // to detect a multi-vendor order, since shipping/tax/discount/total
      // are tracked once per order, not itemized per-store, and would
      // otherwise misattribute other vendors' portions to this one.
      supabaseAdmin.from('order_items').select('store_id').eq('order_id', id)
    ]);

    const shippingAddr = (addresses || []).find(a => a.address_type === 'shipping') || {};
    const billingAddr = (addresses || []).find(a => a.address_type === 'billing') || {};
    const isMultiVendor = new Set((allStoreLinks || []).map(l => l.store_id)).size > 1;
    const vendorItemsSubtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        customerSnapshot: {
          firstName: customer?.first_name || 'Guest',
          lastName: customer?.last_name || 'Customer',
          email: customer?.email || '',
          phone: customer?.phone || ''
        },
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        paymentInfo: payment || {},
        items,
        timeline: timeline || [],
        isMultiVendor,
        subtotal: isMultiVendor ? vendorItemsSubtotal : (order.subtotal || 0),
        shipping_fee: isMultiVendor ? 0 : (order.shipping_fee || 0),
        discount: isMultiVendor ? 0 : (order.discount || 0),
        tax: isMultiVendor ? 0 : (order.tax || 0),
        total_amount: isMultiVendor ? vendorItemsSubtotal : order.total_amount
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
