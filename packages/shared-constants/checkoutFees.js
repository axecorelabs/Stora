// Paystack's Nigeria local-transaction rate -- confirmed against Paystack's
// own pricing docs (https://support.paystack.com/en/articles/2130306):
// every local channel (card, bank transfer, USSD, mobile money) is priced
// identically, 1.5% + NGN100, capped at NGN2,000, with the NGN100 flat
// portion waived under NGN2,500. That uniformity is what makes a single
// blended estimate exact for local payments regardless of which channel a
// customer picks inside Paystack's checkout -- there's no cheaper/pricier
// channel to guess wrong. International cards (3.9% + NGN100, uncapped)
// are deliberately not special-cased here: same as before this feature,
// that rarer shortfall is absorbed by the vendor's settlement share (see
// bearer_type: 'subaccount' in apps/store/src/app/api/payments/initiate/route.js),
// not silently mischarged to anyone.
export const PAYSTACK_LOCAL_FEE_RATE = 0.015;
export const PAYSTACK_LOCAL_FEE_FLAT = 100;
export const PAYSTACK_LOCAL_FEE_FLAT_WAIVER_THRESHOLD = 2500;
export const PAYSTACK_LOCAL_FEE_CAP = 2000;

// Estimates Paystack's own processing fee for a given subtotal, in Naira.
// "Grossed up" rather than a naive rate*subtotal+flat -- Paystack computes
// its fee as a percentage of the *total* amount actually charged, which
// includes this fee once it's added on top, so solving
// fee = rate*(subtotal+fee)+flat (instead of fee = rate*subtotal+flat)
// avoids a small systematic undercollection. Below the cap this matters by
// a few kobo to a few naira; once capped, the cap is a flat ceiling and
// doesn't need grossing up further.
export function estimatePaystackFee(subtotalNaira) {
  if (!(subtotalNaira > 0)) return 0;

  const flatFee = subtotalNaira < PAYSTACK_LOCAL_FEE_FLAT_WAIVER_THRESHOLD ? 0 : PAYSTACK_LOCAL_FEE_FLAT;
  const grossedUpFee = (PAYSTACK_LOCAL_FEE_RATE * subtotalNaira + flatFee) / (1 - PAYSTACK_LOCAL_FEE_RATE);
  const fee = Math.min(grossedUpFee, PAYSTACK_LOCAL_FEE_CAP);

  return Math.round(fee * 100) / 100;
}

// Single source of truth for "what does one payable store's checkout math
// look like", used both by the real order/payment split
// (apps/store/src/app/api/orders/create/route.js's computePaymentSplit)
// and the client-side checkout preview (apps/store/src/components/cart/
// CartPageContent.js) -- so the amount a customer previews in their cart
// can never drift from what actually gets charged. Deliberately excludes
// the Paystack-fee step: that's computed once on the summed total across
// every payable store, not per store (see estimatePaystackFee above), by
// each caller after summing every store's customerAmount here.
export function computeStoreCheckoutAmount({ grossAmount, commissionBearer, commissionRate, minimumCommission }) {
  const rateBasedCommission = Math.round(grossAmount * commissionRate * 100) / 100;
  // Floored at minimumCommission, but never above grossAmount itself --
  // without that cap, a low-priced order would push netAmount negative in
  // 'vendor'-bearer mode.
  const commissionAmount = Math.min(Math.max(rateBasedCommission, minimumCommission), grossAmount);
  const bearer = commissionBearer === 'customer' ? 'customer' : 'vendor';
  const netAmount = bearer === 'customer' ? grossAmount : grossAmount - commissionAmount;
  const customerAmount = bearer === 'customer' ? grossAmount + commissionAmount : grossAmount;

  return { commissionAmount, netAmount, customerAmount, bearer };
}
