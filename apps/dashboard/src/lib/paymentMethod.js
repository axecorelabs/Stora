// order_payments.method has its own narrow CHECK constraint
// ('card','bank_transfer','cash_to_vendor','wallet','paystack','flutterwave' --
// see supabase/migrations/20260717000000_initial_schema.sql), separate from
// (and incompatible with) the UI-level payment choice POS and the
// order-completion flow both collect ('cash'/'transfer'/'pos'). Writing the
// raw UI string straight into order_payments.method (as pos/sales/route.js
// used to) silently fails that constraint on every insert. One shared
// mapper, used by both call sites, so this can't drift out of sync again.
const UI_TO_ORDER_PAYMENT_METHOD = {
  cash: 'cash_to_vendor',
  transfer: 'bank_transfer',
  pos: 'card'
};

export function mapToOrderPaymentMethod(uiValue) {
  return UI_TO_ORDER_PAYMENT_METHOD[uiValue] || null;
}
