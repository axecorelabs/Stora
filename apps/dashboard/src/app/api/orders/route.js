import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');

    // First get the user's store
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          stats: { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 },
          pagination: { current: page, pages: 0, total: 0, limit, hasMore: false }
        }
      });
    }

    // Build base query - Since orders table doesn't have store_id,
    // we need to get orders that have items from this store
    // First get order IDs from order_items for this store
    const { data: orderItemsForStore } = await supabaseAdmin
      .from('order_items')
      .select('order_id')
      .eq('store_id', store.id);
    
    let orderIdsForStore = [...new Set((orderItemsForStore || []).map(item => item.order_id))];

    // Payment status lives on order_payments now, not orders itself
    if (paymentStatus && orderIdsForStore.length > 0) {
      const { data: matchingPayments } = await supabaseAdmin
        .from('order_payments')
        .select('order_id')
        .eq('status', paymentStatus)
        .in('order_id', orderIdsForStore);
      const matchingOrderIds = new Set((matchingPayments || []).map(p => p.order_id));
      orderIdsForStore = orderIdsForStore.filter(id => matchingOrderIds.has(id));
    }

    if (orderIdsForStore.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          stats: { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 },
          pagination: { current: page, pages: 0, total: 0, limit, hasMore: false }
        }
      });
    }

    // Build base query - filter by order IDs
    let query = supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact' })
      .in('id', orderIdsForStore);

    // Add status filter
    if (status) {
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => s.trim());
        query = query.in('status', statusArray);
      } else {
        query = query.eq('status', status);
      }
    }

    // Add search filter
    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }

    // Get paginated results
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data: rawOrders, error, count: totalCount } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Orders fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Fetch order_items separately for these orders
    const orderIds = (rawOrders || []).map(o => o.id);
    let orderItemsMap = {};
    
    if (orderIds.length > 0) {
      // Fetch order items
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('order_id, id, product_id, product_name, product_sku, product_image, product_category, variant_color, variant_size, quantity, unit_price, subtotal, item_status')
        .in('order_id', orderIds);
      
      // Create a map of order_id -> items array
      (orderItems || []).forEach(item => {
        if (!orderItemsMap[item.order_id]) {
          orderItemsMap[item.order_id] = [];
        }
        orderItemsMap[item.order_id].push(item);
      });
    }

    // Fetch the normalized customer/address/payment rows for these orders
    // (orders itself carries no snapshot columns; that data lives in its child tables)
    let orderCustomerMap = {};
    let orderAddressMap = {};
    let orderPaymentMap = {};
    if (orderIds.length > 0) {
      const [{ data: orderCustomers }, { data: orderAddresses }, { data: orderPayments }] = await Promise.all([
        supabaseAdmin.from('order_customers').select('*').in('order_id', orderIds),
        supabaseAdmin.from('order_addresses').select('*').in('order_id', orderIds),
        supabaseAdmin.from('order_payments').select('*').in('order_id', orderIds)
      ]);
      (orderCustomers || []).forEach(c => { orderCustomerMap[c.order_id] = c; });
      (orderAddresses || []).forEach(a => {
        if (!orderAddressMap[a.order_id]) orderAddressMap[a.order_id] = {};
        orderAddressMap[a.order_id][a.address_type] = a;
      });
      (orderPayments || []).forEach(p => { orderPaymentMap[p.order_id] = p; });
    }

    // Transform orders to match frontend expected format
    const orders = (rawOrders || []).map(order => {
      const items = orderItemsMap[order.id] || [];
      const customerSnapshot = orderCustomerMap[order.id] || {};
      const shippingAddr = orderAddressMap[order.id]?.shipping || {};
      const billingAddr = orderAddressMap[order.id]?.billing || {};
      const paymentInfo = orderPaymentMap[order.id] || {};

      // Get unique store IDs from items
      const storeIds = [...new Set(items.map(item => item.store_id).filter(Boolean))];
      
      return {
        ...order,
        customerSnapshot: {
          firstName: customerSnapshot.firstName || customerSnapshot.first_name || 'Guest',
          lastName: customerSnapshot.lastName || customerSnapshot.last_name || 'Customer',
          email: customerSnapshot.email || '',
          phone: customerSnapshot.phone || ''
        },
        shippingAddress: {
          firstName: shippingAddr.firstName || shippingAddr.first_name || '',
          lastName: shippingAddr.lastName || shippingAddr.last_name || '',
          phone: shippingAddr.phone || '',
          street: shippingAddr.street || '',
          city: shippingAddr.city || '',
          state: shippingAddr.state || '',
          country: shippingAddr.country || 'Nigeria',
          postalCode: shippingAddr.postalCode || shippingAddr.postal_code || '',
          landmark: shippingAddr.landmark || ''
        },
        billingAddress: {
          firstName: billingAddr.firstName || billingAddr.first_name || '',
          lastName: billingAddr.lastName || billingAddr.last_name || '',
          phone: billingAddr.phone || '',
          street: billingAddr.street || '',
          city: billingAddr.city || '',
          state: billingAddr.state || '',
          country: billingAddr.country || 'Nigeria',
          postalCode: billingAddr.postalCode || billingAddr.postal_code || '',
          landmark: billingAddr.landmark || ''
        },
        items: items.map(item => ({
          ...item,
          // Map product_id to _id for POS compatibility
          _id: item.product_id,
          product_id: item.product_id, // Explicitly include for OrderDetailsModal
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
            size: item.variant_size
          },
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
          status: item.item_status
        })),
        itemCount: items.length,
        stores: storeIds.map(id => ({ id })),
        paymentInfo: {
          status: paymentInfo.status || 'pending',
          method: paymentInfo.method || 'card'
        },
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        discount: order.discount || 0,
        createdAt: order.created_at
      };
    });

    // Calculate stats using a separate query
    // Get all orders for this store via order_items -- revenue uses this
    // store's item subtotals, not the whole (possibly multi-vendor) order total.
    const { data: allOrderItemsForStats } = await supabaseAdmin
      .from('order_items')
      .select('order_id, subtotal')
      .eq('store_id', store.id);

    const allOrderIdsForStore = [...new Set((allOrderItemsForStats || []).map(item => item.order_id))];

    let allOrders = [];
    if (allOrderIdsForStore.length > 0) {
      const { data: ordersData } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .in('id', allOrderIdsForStore);
      allOrders = ordersData || [];
    }

    const revenueOrderIds = new Set(
      allOrders.filter(o => ['processed', 'shipped', 'delivered'].includes(o.status)).map(o => o.id)
    );

    const stats = {
      totalOrders: allOrders?.length || 0,
      pendingOrders: allOrders?.filter(o => ['pending', 'confirmed'].includes(o.status))?.length || 0,
      completedOrders: allOrders?.filter(o => o.status === 'delivered')?.length || 0,
      totalRevenue: (allOrderItemsForStats || [])
        .filter(i => revenueOrderIds.has(i.order_id))
        .reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        orders: orders || [],
        stats,
        pagination: {
          current: page,
          pages: Math.ceil((totalCount || 0) / limit),
          total: totalCount || 0,
          limit,
          hasMore: page < Math.ceil((totalCount || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
