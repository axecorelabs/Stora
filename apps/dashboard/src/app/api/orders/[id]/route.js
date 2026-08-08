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

    const [{ data: customer }, { data: addresses }, { data: payment }, { data: timeline }] = await Promise.all([
      supabaseAdmin.from('order_customers').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_addresses').select('*').eq('order_id', id),
      supabaseAdmin.from('order_payments').select('*').eq('order_id', id).maybeSingle(),
      supabaseAdmin.from('order_timeline').select('*').eq('order_id', id).order('timestamp', { ascending: true })
    ]);

    const shippingAddr = (addresses || []).find(a => a.address_type === 'shipping') || {};
    const billingAddr = (addresses || []).find(a => a.address_type === 'billing') || {};

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
        timeline: timeline || []
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
