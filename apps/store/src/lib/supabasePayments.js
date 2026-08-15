import { supabaseAdmin } from './supabase';
import { updateOrderStatus } from './supabaseOrders';

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

  // Payment confirmation and stock fulfillment are separate lifecycle
  // events -- this only moves the order to 'confirmed', stock stays
  // reserved (not sold) until real delivery, same as every other order.
  try {
    await updateOrderStatus(orderPayment.order_id, 'confirmed');
  } catch (statusError) {
    console.error('Error confirming order status after payment:', statusError);
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
