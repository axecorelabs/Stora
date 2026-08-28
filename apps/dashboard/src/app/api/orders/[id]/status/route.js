import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { sendOrderProcessedEmail } from '@/lib/email';
import { processItemsWithBatchTracking, releaseItemsReservation } from '@/lib/batchInventory';
import { captureServerEvent } from '@/lib/posthog-server';

// PUT - Update order status
export async function PUT(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { status, note, updatedBy, trackingInfo } = await req.json();

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'processed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      );
    }

    console.log(`Updating order ${id} to status: ${status}`);

    // First get the user's store
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, store_name')
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json(
        { success: false, message: 'Store not found' },
        { status: 404 }
      );
    }

    // orders is multi-vendor: permission is scoped through order_items.store_id,
    // not orders.store_id (orders has no store_id column).
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    const { data: storeItems } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .eq('store_id', store.id);

    if (!storeItems || storeItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`Found order ${order.order_number}, current status: ${order.status}`);

    // Check if this is a status change to "delivered" or "cancelled" -- stock
    // is reserved (not yet deducted) at order-creation time, so delivery must
    // fulfill that reservation (deduct real stock, consume batches FIFO,
    // record a sale) and cancellation must release it (no stock ever leaves).
    const isBeingMarkedAsDelivered = status === 'delivered' && order.status !== 'delivered';
    const isBeingCancelled = status === 'cancelled' && !['cancelled', 'delivered'].includes(order.status);

    // Prepare update data
    let updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    // Update tracking information if provided
    if (trackingInfo && status === 'shipped') {
      updateData.tracking_carrier = trackingInfo.carrier;
      updateData.tracking_number = trackingInfo.trackingNumber;
      updateData.estimated_delivery = trackingInfo.estimatedDelivery ? new Date(trackingInfo.estimatedDelivery).toISOString() : null;
      updateData.shipped_at = new Date().toISOString();
    }

    // Update status-specific timestamps
    if (status === 'confirmed' && !order.confirmed_at) {
      updateData.confirmed_at = new Date().toISOString();
    } else if (status === 'shipped' && !order.shipped_at) {
      updateData.shipped_at = new Date().toISOString();
    } else if (status === 'delivered' && !order.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'cancelled' && !order.cancelled_at) {
      updateData.cancelled_at = new Date().toISOString();
    }

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update order status' },
        { status: 500 }
      );
    }

    console.log(`Order status updated to: ${status}`);

    // If order is being marked as delivered, fulfill this store's reserved
    // stock (release the reservation, deduct real stock/batches FIFO) and
    // record a proper sale -- scoped to this store's items only, since one
    // seller marking their items delivered must not affect another seller's
    // items on the same multi-vendor order.
    let saleResults = null;
    if (isBeingMarkedAsDelivered) {
      console.log('Order marked as delivered, fulfilling reservations and recording sale...');
      try {
        const { data: payment } = await supabaseAdmin
          .from('order_payments')
          .select('method')
          .eq('order_id', id)
          .maybeSingle();

        const saleId = crypto.randomUUID();
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let totalCostFromBatches = 0;
        let totalProfitFromBatches = 0;
        let totalBatchesUsed = 0;
        const saleItemRows = [];
        const saleItemBatchRows = [];

        // One round trip for every item on this store's part of the order,
        // instead of up to 3 per item (see batchInventory.js).
        const processedResults = await processItemsWithBatchTracking(
          storeItems.map(item => ({
            inventoryId: item.product_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.subtotal,
            productName: item.product_name,
            sku: item.product_sku,
            variant: (item.variant_size || item.variant_color)
              ? { size: item.variant_size, color: item.variant_color }
              : null
          })),
          user.id,
          true, // isOrderProcessing: releases the reservation made at checkout, deducts real stock
          id // relatedId -> inventory_activities.related_order_id, so this fulfillment traces back to the order
        );

        for (const { saleItemData, batchesUsed, totalCost, totalProfit } of processedResults) {
          const { batches_sold_from, ...saleItemFields } = saleItemData;
          saleItemRows.push({ ...saleItemFields, sale_id: saleId });
          if (batches_sold_from) {
            saleItemBatchRows.push({ itemId: saleItemFields.id, batches: batches_sold_from });
          }
          totalCostFromBatches += totalCost;
          totalProfitFromBatches += totalProfit;
          totalBatchesUsed += batchesUsed;
        }

        const totalQuantity = storeItems.reduce((sum, i) => sum + i.quantity, 0);

        const { data: createdSale, error: saleError } = await supabaseAdmin
          .from('sales')
          .insert({
            id: saleId,
            user_id: user.id,
            transaction_id: transactionId,
            order_id: id,
            order_number: order.order_number,
            seller_id: storeItems[0]?.seller_id || null,
            store_id: store.id,
            subtotal: storeItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0),
            tax: 0,
            discount: 0,
            total: storeItems.reduce((sum, i) => sum + parseFloat(i.subtotal), 0),
            sale_date: new Date().toISOString(),
            payment_method: payment?.method || 'unknown',
            status: 'completed',
            is_from_order: true,
            total_batches_used: totalBatchesUsed,
            total_cost_from_batches: totalCostFromBatches,
            total_profit_from_batches: totalProfitFromBatches,
            average_cost_per_unit: totalQuantity > 0 ? totalCostFromBatches / totalQuantity : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (saleError || !createdSale) {
          throw new Error(saleError?.message || 'Failed to create sale');
        }

        const { data: insertedSaleItems, error: itemsError } = await supabaseAdmin
          .from('sale_items')
          .insert(saleItemRows)
          .select();

        if (itemsError) {
          throw new Error(`Failed to record sale items: ${itemsError.message}`);
        }

        const batchRecords = [];
        saleItemBatchRows.forEach(({ itemId, batches }) => {
          const insertedItem = insertedSaleItems.find(si => si.id === itemId);
          if (!insertedItem) return;
          batches.forEach(batch => {
            batchRecords.push({
              id: crypto.randomUUID(),
              sale_item_id: insertedItem.id,
              batch_id: batch.batchId,
              batch_code: batch.batchCode,
              quantity_from_batch: batch.quantityFromBatch,
              cost_price_from_batch: batch.costPriceFromBatch,
              created_at: new Date().toISOString()
            });
          });
        });

        if (batchRecords.length > 0) {
          const { error: batchError } = await supabaseAdmin.from('sale_item_batches').insert(batchRecords);
          if (batchError) {
            console.error('Sale item batches insert error (non-fatal):', batchError);
          }
        }

        saleResults = { success: true, sales: [createdSale] };
        console.log(`Successfully created sale for order ${order.order_number}`);
      } catch (saleError) {
        console.error('Error fulfilling order delivery:', saleError);

        // Return error information but don't fail the status update
        return NextResponse.json({
          success: true,
          message: `Order status updated to ${status}, but sale creation failed: ${saleError.message}`,
          data: updatedOrder,
          saleCreationError: saleError.message,
          warning: 'Sales were not automatically created due to an error'
        });
      }
    }

    // If cancelled before fulfillment, release the reserved stock back to
    // availability -- it was never actually deducted, only earmarked.
    if (isBeingCancelled) {
      console.log('Order cancelled, releasing reserved stock...');
      try {
        await releaseItemsReservation(
          storeItems.map(item => ({
            inventoryId: item.product_id,
            quantity: item.quantity,
            variant: (item.variant_size || item.variant_color)
              ? { size: item.variant_size, color: item.variant_color, variantId: item.variant_id }
              : null
          }))
        );
      } catch (releaseError) {
        console.error(`Failed to release reservations for order ${id}:`, releaseError);
        // Don't fail the status update if release fails
      }
    }

    // Send order processed email if sales were created successfully
    const { data: orderCustomer } = await supabaseAdmin
      .from('order_customers')
      .select('*')
      .eq('order_id', id)
      .maybeSingle();

    if (orderCustomer?.email && saleResults && saleResults.sales.length > 0) {
      // Deferred -- this is PDF receipt generation (logo fetch, jsPDF
      // render, QR code) *then* an SMTP send with up to 3 retries, on the
      // single most common vendor action (marking an order delivered).
      // The try/catch below already discards failures (console.error, no
      // rethrow), so waiting on it bought zero benefit, only latency.
      const storeName = store?.store_name || 'Stora Store';
      const sale = saleResults.sales[0];
      after(async () => {
        console.log('Attempting to send order processed email to customer...', orderCustomer.email);
        try {
          await sendOrderProcessedEmail(
            orderCustomer.email,
            {
              orderNumber: order.order_number,
              customer: {
                name: `${orderCustomer.first_name || ''} ${orderCustomer.last_name || ''}`.trim(),
                phone: orderCustomer.phone || '',
                email: orderCustomer.email
              }
            },
            {
              transactionId: sale.transaction_id,
              items: saleResults.sales,
              total: saleResults.sales.reduce((sum, s) => sum + s.total, 0),
              subtotal: saleResults.sales.reduce((sum, s) => sum + s.subtotal, 0),
              discount: 0,
              tax: 0,
              saleDate: sale.sale_date,
              paymentMethod: sale.payment_method
            },
            storeName
          );
          console.log('Order processed email sent successfully');
        } catch (emailError) {
          console.error('Failed to send order processed email:', emailError);
        }
      });
    }

    const response = {
      success: true,
      message: `Order status updated to ${status}`,
      data: updatedOrder
    };

    // Add sale information if created
    if (saleResults && saleResults.success) {
      response.salesCreated = {
        count: saleResults.sales.length,
        totalAmount: saleResults.sales.reduce((sum, sale) => sum + sale.total, 0),
        transactionIds: saleResults.sales.map(sale => sale.transaction_id)
      };
      response.message += ` and ${saleResults.sales.length} sale(s) created automatically`;
    }

    after(() => captureServerEvent(user.id, 'order_status_updated', {
      order_status: status,
      previous_order_status: order.status,
      sales_created: Boolean(saleResults?.success)
    }));
    if (isBeingMarkedAsDelivered && saleResults?.success) {
      after(() => captureServerEvent(user.id, 'order_delivered', {
        sales_created: saleResults.sales.length
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Order status update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
