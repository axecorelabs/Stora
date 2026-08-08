import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/auth";
import { sendNewOrderNotification } from "@/lib/email";
import { createOrder, reserveStockFIFO } from "@/lib/supabaseOrders";
import { getOrCreateCart, clearCart } from "@/lib/supabaseCart";
import { findInventoryById } from "@/lib/supabaseStore";
import { supabaseAdmin } from "@/lib/supabase";

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

export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { cartId, shippingAddress, customerNotes, paymentMethod = 'cash_to_vendor' } = await request.json();

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.phone || !shippingAddress.city || !shippingAddress.state) {
      return NextResponse.json(
        { success: false, message: "Complete shipping address is required" },
        { status: 400 }
      );
    }

    // Get cart with items
    const cart = await getOrCreateCart(customerId, true);

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cart is empty" },
        { status: 400 }
      );
    }

    // Validate stock and prepare order items
    const orderItems = [];
    const stockUpdates = [];
    const storeDataCache = new Map();

    for (const cartItem of cart.items) {
      const product = await findInventoryById(cartItem.product_id);
      
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

      // Check stock availability (use availableQuantity which accounts for reservations)
      const availableStock = product.availableQuantity || 0;
      if (availableStock < cartItem.quantity) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Insufficient stock for ${product.productName}. Available: ${availableStock}` 
          },
          { status: 400 }
        );
      }

      // Fetch complete store data if not cached
      if (!storeDataCache.has(cartItem.store_id)) {
        const storeData = await fetchStoreData(cartItem.store_id);
        storeDataCache.set(cartItem.store_id, storeData);
      }
      const completeStoreData = storeDataCache.get(cartItem.store_id);

      // Prepare order item with complete store snapshot
      orderItems.push({
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
        variant: cartItem.variant || null,
        batchId: cartItem.batch_id || null,
        batchCode: cartItem.batch_code || null
      });

      // Track stock updates
      stockUpdates.push({
        inventoryId: cartItem.product_id,
        quantityToReserve: cartItem.quantity,
        variantData: cartItem.variant || null
      });
    }

    // Calculate totals
    const subtotal = cart.subtotal;
    const totalAmount = cart.total;

    // Create order using Supabase
    const order = await createOrder({
      customerId,
      items: orderItems,
      shippingAddress,
      subtotal,
      tax: cart.tax || 0,
      shippingFee: cart.shipping || 0,
      discount: cart.discount || 0,
      couponDiscount: cart.coupon_discount || 0,
      totalAmount,
      customerNotes,
      paymentMethod,
      orderSource: 'web'
    });

    // Reserve stock using FIFO
    try {
      for (const update of stockUpdates) {
        await reserveStockFIFO(update.inventoryId, update.quantityToReserve, update.variantData);
      }
    } catch (stockError) {
      console.error("Error reserving stock:", stockError);
      return NextResponse.json(
        { success: false, message: `Stock reservation failed: ${stockError.message}` },
        { status: 500 }
      );
    }

    // Clear cart
    await clearCart(cart);

    // Send email notifications to store owners
    try {
      // Fetch store snapshots from order_stores table
      const { data: orderStores } = await supabaseAdmin
        .from('order_stores')
        .select('*')
        .in('order_item_id', order.order_items.map(item => item.id));

      // Create store lookup map
      const storeMap = new Map();
      if (orderStores) {
        for (const store of orderStores) {
          storeMap.set(store.store_id, store);
        }
      }

      // Group items by store
      const storeGroupedItems = {};
      
      for (const item of order.order_items) {
        const storeId = item.store_id;
        if (!storeGroupedItems[storeId]) {
          storeGroupedItems[storeId] = {
            store: storeMap.get(storeId),
            items: [],
            total: 0
          };
        }
        storeGroupedItems[storeId].items.push(item);
        storeGroupedItems[storeId].total += parseFloat(item.subtotal);
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

    return NextResponse.json({
      success: true,
      message: "Order created successfully",
      order: {
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        status: order.status
      }
    });

  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create order", error: error.message },
      { status: 500 }
    );
  }
}
