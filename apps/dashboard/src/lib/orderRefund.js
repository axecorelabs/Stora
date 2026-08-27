// Shared refund-eligibility rule -- was inlined once inside
// OrderDetailsContent.js (canRefund()); now also needed by the Orders
// list's own quick-action Refund button, so it's a single function both
// import rather than a second hand-copied version drifting out of sync
// with the refund route's own guards (apps/dashboard/src/app/api/orders/[id]/refund/route.js).
//
// A refund is only meaningful once there's a real online payment to
// refund from, and only once (a split already 'reversed' has nothing
// left).
export function canRefundOrder(order) {
  return Boolean(
    order?.paymentInfo?.provider === 'paystack' &&
    ['completed', 'partially_refunded'].includes(order?.paymentInfo?.status) &&
    order?.refundSplit &&
    order.refundSplit.status !== 'reversed'
  );
}

// Cheaper pre-filter for list views that only have paymentInfo (no
// refundSplit -- see apps/dashboard/src/app/api/orders/route.js) -- used
// to decide whether the quick-action Refund button is worth showing at
// all before paying for a full single-order fetch. Not authoritative:
// still narrows out cash/POS orders and anything never actually paid, but
// an order that's already been fully refunded can still pass this and
// get correctly rejected by canRefundOrder() once the real data loads.
export function mightBeRefundable(order) {
  return Boolean(
    order?.paymentInfo?.provider === 'paystack' &&
    ['completed', 'partially_refunded'].includes(order?.paymentInfo?.status)
  );
}
