import { after } from "next/server";
import { supabaseAdmin } from "./supabase";
import { sendNewOrderNotification } from "./email";
import { findOrderById } from "./supabaseOrders";

// Low-level: the caller already has the order and its store-grouped items
// in scope (orders/create builds both right after creating the order), so
// this does no extra fetching. Scoped to a storeIds subset rather than
// always notifying every store on the order -- a mixed Paystack cart
// splits into stores that are contact-only (no online payment gating them,
// notified immediately) and stores covered by a pending charge (notified
// only once confirmOrderPayment() confirms it -- see notifyStoresOfPaidOrder
// below and apps/store/src/lib/supabasePayments.js). Notifying a paying
// vendor before the money has actually moved would tell them about an
// order that might never really happen.
export async function sendStoreOrderNotifications(
  { orderId, orderNumber, shippingAddress, customerNotes },
  storeGroupedItems,
  storeIds
) {
  if (!storeIds || storeIds.length === 0) return;

  // In-app notification insert is isolated in its own try/catch so a
  // failure here never blocks the email loop below (or order creation,
  // per the outer catch at each call site).
  try {
    const { data: storeOwners } = await supabaseAdmin
      .from('stores')
      .select('id, owner_id')
      .in('id', storeIds);
    const ownerByStoreId = new Map((storeOwners || []).map(s => [s.id, s.owner_id]));

    const notificationRows = [];
    for (const storeId of storeIds) {
      const storeData = storeGroupedItems[storeId];
      if (!storeData) continue;
      const ownerId = ownerByStoreId.get(storeId);
      if (!ownerId) continue;

      const itemCount = storeData.items.reduce((sum, item) => sum + item.quantity, 0);
      notificationRows.push({
        user_id: ownerId,
        title: 'New order received',
        message: `Order ${orderNumber} - ${itemCount} item${itemCount === 1 ? '' : 's'}, ₦${Number(storeData.total).toLocaleString('en-NG')}`,
        type: 'order',
        related_entity_type: 'order',
        related_entity_id: orderId,
        data: { orderId, orderNumber, storeTotal: storeData.total, itemCount }
      });
    }

    if (notificationRows.length > 0) {
      const { error: notifyError } = await supabaseAdmin.from('notifications').insert(notificationRows);
      if (notifyError) console.error('Error inserting order notifications:', notifyError);
    }
  } catch (notifyError) {
    console.error('Error creating order notifications (non-fatal):', notifyError);
  }

  // Deferred -- on a multi-vendor cart this is N sequential SMTP
  // round-trips (one per store), and sendNewOrderNotification already
  // swallows its own errors, so waiting on it here bought no delivery
  // guarantee, only latency at exactly the busiest moment.
  after(async () => {
    for (const storeId of storeIds) {
      const storeData = storeGroupedItems[storeId];
      if (!storeData) continue;
      const storeEmail = storeData.store?.store_email;
      if (!storeEmail) continue;

      const emailData = {
        _id: orderId,
        orderNumber,
        customerSnapshot: {
          firstName: shippingAddress?.firstName,
          lastName: shippingAddress?.lastName,
          phone: shippingAddress?.phone
        },
        shippingAddress,
        customerNotes,
        storeItems: storeData.items,
        storeTotal: storeData.total,
        storeItemCount: storeData.items.reduce((sum, item) => sum + item.quantity, 0)
      };

      try {
        await sendNewOrderNotification(storeEmail, storeData.store.store_name, emailData);
        console.log(`Order notification email sent to ${storeData.store.store_name} (${storeEmail})`);
      } catch (emailError) {
        console.error(`Error sending order notification to ${storeData.store.store_name}:`, emailError);
      }
    }
  });
}

// High-level: used from the payment-confirmation path (webhook/verify),
// which only has an orderId and the paid stores' ids -- no order or
// storeGroupedItems already in scope -- so it reconstructs both via
// findOrderById and reshapes them into the same per-store shape
// sendStoreOrderNotifications expects, rather than duplicating the
// notification/email logic a second time.
export async function notifyStoresOfPaidOrder(orderId, storeIds) {
  if (!storeIds || storeIds.length === 0) return;

  const order = await findOrderById(orderId);
  if (!order) {
    console.error('notifyStoresOfPaidOrder: order not found', orderId);
    return;
  }

  const storeGroupedItems = {};
  for (const storeGroup of order.stores || []) {
    storeGroupedItems[storeGroup.storeId] = {
      store: {
        store_name: storeGroup.storeName,
        store_email: storeGroup.storeEmail
      },
      items: storeGroup.items,
      total: storeGroup.subtotal
    };
  }

  await sendStoreOrderNotifications(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      shippingAddress: order.shippingAddress,
      customerNotes: order.customerNotes
    },
    storeGroupedItems,
    storeIds
  );
}
