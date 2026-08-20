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
    const createdFrom = searchParams.get('createdFrom');
    const createdTo = searchParams.get('createdTo');
    const skipStats = searchParams.get('skipStats') === 'true';

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

    // Date-range filter -- on orders.created_at (indexed: idx_orders_created_at),
    // not order_items, so it stays within the existing count('exact') query
    // rather than adding a separate pass over order_items.
    if (createdFrom) {
      query = query.gte('created_at', createdFrom);
    }
    if (createdTo) {
      query = query.lte('created_at', createdTo);
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

    // Fetch order_items separately for these orders. Scoped to this
    // vendor's own store_id -- an order can span multiple vendors sharing
    // one order_number, and without this filter a vendor viewing an order
    // they only partially fulfilled would see every other vendor's product
    // names, quantities, and prices too (confirmed real gap: the store-scoped
    // query above only decides which ORDERS are visible, not which ITEMS
    // within a shared one are).
    const orderIds = (rawOrders || []).map(o => o.id);
    let orderItemsMap = {};
    let orderStoreIdsMap = {}; // order_id -> Set of every store's id on that order (not item-level detail), used only to detect a multi-vendor order so order-level shipping/tax/discount/total (not itemized per-store) aren't shown as if they were this vendor's alone.

    if (orderIds.length > 0) {
      const [{ data: orderItems }, { data: allStoreLinks }] = await Promise.all([
        supabaseAdmin
          .from('order_items')
          .select('order_id, id, product_id, product_name, product_sku, product_image, product_category, variant_color, variant_size, quantity, unit_price, subtotal, item_status, notes')
          .in('order_id', orderIds)
          .eq('store_id', store.id),
        supabaseAdmin
          .from('order_items')
          .select('order_id, store_id')
          .in('order_id', orderIds)
      ]);

      // Create a map of order_id -> items array (this vendor's own items only)
      (orderItems || []).forEach(item => {
        if (!orderItemsMap[item.order_id]) {
          orderItemsMap[item.order_id] = [];
        }
        orderItemsMap[item.order_id].push(item);
      });

      (allStoreLinks || []).forEach(link => {
        if (!orderStoreIdsMap[link.order_id]) orderStoreIdsMap[link.order_id] = new Set();
        orderStoreIdsMap[link.order_id].add(link.store_id);
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

      const storeIds = [...(orderStoreIdsMap[order.id] || [])];
      const isMultiVendor = storeIds.length > 1;
      // This vendor's own item total -- the only figure that's meaningful
      // to show them on a multi-vendor order, since shipping/tax/discount
      // are tracked once per order, not itemized per-store, and the whole
      // order.total_amount includes every other vendor's items too.
      const vendorItemsSubtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

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
          status: item.item_status,
          notes: item.notes || null
        })),
        itemCount: items.length,
        stores: storeIds.map(id => ({ id })),
        isMultiVendor,
        paymentInfo: {
          status: paymentInfo.status || 'pending',
          method: paymentInfo.method || 'card'
        },
        orderNumber: order.order_number,
        // Single-vendor order: the order genuinely is this vendor's in
        // full, so the real order-level figures are accurate. Multi-vendor:
        // shipping/tax/discount aren't split per-store at all, so showing
        // the order-wide figures here would attribute other vendors'
        // portions to this one -- show just this vendor's own items total.
        subtotal: isMultiVendor ? vendorItemsSubtotal : (order.subtotal || 0),
        shippingFee: isMultiVendor ? 0 : (order.shipping_fee || 0),
        discount: isMultiVendor ? 0 : (order.discount || 0),
        tax: isMultiVendor ? 0 : (order.tax || 0),
        totalAmount: isMultiVendor ? vendorItemsSubtotal : order.total_amount,
        createdAt: order.created_at
      };
    });

    // Calculate stats using a separate query -- re-fetches this store's
    // entire order_items/orders history, so it's skipped for callers that
    // only want the paginated list + count (e.g. the dashboard's
    // today-orders/pending-orders polls, which never read `stats`),
    // rather than paying this on every poll.
    let stats = { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 };
    if (!skipStats) {
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

      stats = {
        totalOrders: allOrders?.length || 0,
        pendingOrders: allOrders?.filter(o => ['pending', 'confirmed'].includes(o.status))?.length || 0,
        completedOrders: allOrders?.filter(o => o.status === 'delivered')?.length || 0,
        totalRevenue: (allOrderItemsForStats || [])
          .filter(i => revenueOrderIds.has(i.order_id))
          .reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0)
      };
    }

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
