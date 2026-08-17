import { supabaseAdmin } from './supabase';
import { updateOrderStatus } from './supabaseOrders';
import { notifyStoresOfPaidOrder } from './orderNotifications';
import { removeItemsFromCart } from './supabaseCart';

// Shared idempotent core called from both the webhook path and the
// client verify-on-return path (apps/store/src/app/api/payments/webhook/route.js,
// apps/store/src/app/api/payments/verify/route.js). Neither path trusts
// the other -- whichever arrives first wins, the second is a no-op.
export async function confirmOrderPayment(reference, { transactionId, amountKobo }) {
  const { data: orderPayment, error } = await supabaseAdmin
    .from('order_payments')
    .select('*')
    .eq('reference', reference)
    .single();

  if (error || !orderPayment) {
    return { success: false, message: 'Payment record not found' };
  }

  // Idempotent no-op -- covers webhook retries, webhook/verify racing
  // each other, or a customer refreshing the callback page twice.
  if (orderPayment.status === 'completed') {
    return { success: true, orderId: orderPayment.order_id, alreadyConfirmed: true };
  }

  const expectedAmountKobo = Math.round(parseFloat(orderPayment.amount) * 100);
  if (amountKobo !== expectedAmountKobo) {
    console.error('Payment amount mismatch:', { reference, expectedAmountKobo, amountKobo });
    return { success: false, message: 'Payment amount mismatch' };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('order_payments')
    .update({ status: 'completed', paid_at: now, transaction_id: transactionId, updated_at: now })
    .eq('id', orderPayment.id);

  if (updateError) {
    console.error('Error marking payment completed:', updateError);
    return { success: false, message: 'Failed to record payment' };
  }

  // Guard against the order having been auto-cancelled (by the abandoned-
  // payment cleanup job, 30 min of inactivity) in the window between the
  // customer opening the Paystack popup and actually paying. Cancellation
  // already released this order's stock reservation back to general
  // availability -- money has genuinely moved, but silently flipping the
  // order to 'confirmed' here would claim stock that may no longer exist
  // (already sold to someone else). Record the payment truthfully and
  // flag it for manual reconciliation instead of pretending it's fine.
  const { data: currentOrder } = await supabaseAdmin
    .from('orders')
    .select('status, admin_notes')
    .eq('id', orderPayment.order_id)
    .single();

  if (currentOrder?.status === 'cancelled') {
    console.error('CRITICAL: payment completed for an already-cancelled order -- needs manual reconciliation', {
      orderId: orderPayment.order_id,
      reference
    });
    const flaggedNote = `[NEEDS RECONCILIATION] Payment of ₦${(expectedAmountKobo / 100).toLocaleString('en-NG')} was received after this order was auto-cancelled for inactivity. Its stock reservation was already released and may no longer be available -- contact customer service before treating this as a normal confirmed order.`;
    await supabaseAdmin
      .from('orders')
      .update({
        admin_notes: currentOrder.admin_notes ? `${currentOrder.admin_notes}\n${flaggedNote}` : flaggedNote,
        updated_at: now
      })
      .eq('id', orderPayment.order_id);
    await supabaseAdmin.from('order_timeline').insert({
      order_id: orderPayment.order_id,
      status: currentOrder.status,
      from_status: currentOrder.status,
      note: flaggedNote,
      updated_by: 'system',
      timestamp: now
    });
    return { success: true, orderId: orderPayment.order_id, alreadyConfirmed: false, needsReconciliation: true };
  }

  // Payment confirmation and stock fulfillment are separate lifecycle
  // events -- this only moves the order to 'confirmed', stock stays
  // reserved (not sold) until real delivery, same as every other order.
  try {
    await updateOrderStatus(orderPayment.order_id, 'confirmed');
  } catch (statusError) {
    console.error('Error confirming order status after payment:', statusError);
  }

  // Clear this order's items out of the customer's cart now that payment
  // has actually confirmed -- deferred from order creation (see
  // orders/create/route.js) specifically so a failed/abandoned payment
  // attempt doesn't leave the customer with an already-emptied cart and
  // nothing to show for it. Scoped via pending_order_id (set at checkout
  // time) rather than re-deriving which items belong to this order by
  // product match. Non-fatal: a failure here must not turn an otherwise-
  // successful payment confirmation into an error response.
  try {
    const { data: paidCartItems } = await supabaseAdmin
      .from('cart_items')
      .select('id, cart_id')
      .eq('pending_order_id', orderPayment.order_id);
    if (paidCartItems && paidCartItems.length > 0) {
      await removeItemsFromCart({ id: paidCartItems[0].cart_id }, paidCartItems.map(i => i.id));
    }
  } catch (cartError) {
    console.error('Error clearing paid items from cart:', cartError);
  }

  // Vendor notifications for this order's paid stores were deliberately
  // held until now (see apps/store/src/app/api/orders/create/route.js) --
  // notifying before the charge actually completed would tell a vendor
  // about an order that might never really happen. Non-fatal: a failure
  // here must not turn an otherwise-successful payment confirmation into
  // an error response back to the customer.
  try {
    const { data: splits } = await supabaseAdmin
      .from('order_payment_splits')
      .select('store_id')
      .eq('order_payment_id', orderPayment.id);
    const paidStoreIds = [...new Set((splits || []).map(s => s.store_id))];
    await notifyStoresOfPaidOrder(orderPayment.order_id, paidStoreIds);
  } catch (notifyError) {
    console.error('Error notifying vendors after payment confirmation:', notifyError);
  }

  return { success: true, orderId: orderPayment.order_id, alreadyConfirmed: false };
}

// charge.failed webhook path -- never downgrades an already-completed
// payment (a stale failed event arriving after a successful one must be
// a no-op, not a regression).
export async function markOrderPaymentFailed(reference) {
  const { data: orderPayment } = await supabaseAdmin
    .from('order_payments')
    .select('id, status')
    .eq('reference', reference)
    .maybeSingle();

  if (!orderPayment || orderPayment.status === 'completed') return;

  await supabaseAdmin
    .from('order_payments')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', orderPayment.id);
}
