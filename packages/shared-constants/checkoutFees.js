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
// Distinguishes "vendor hasn't configured a fee for this state" (missing/
// undefined/blank key) from "vendor configured it as zero, i.e. genuinely
// free delivery" (key present, value 0) -- the ubiquitous
// `Number(fees?.[state]) || 0` pattern collapses both into the same ₦0,
// which silently tells a customer delivery is free when really the vendor
// just never got around to pricing that state. Every fee lookup should go
// through this instead of reaching into the fees object directly.
export function resolveDeliveryFee(deliveryFees, state) {
  if (!state || !deliveryFees || typeof deliveryFees !== 'object') {
    return { amount: 0, isSet: false };
  }
  const raw = deliveryFees[state];
  if (raw === undefined || raw === null || raw === '') {
    return { amount: 0, isSet: false };
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return { amount: 0, isSet: false };
  }
  return { amount, isSet: true };
}

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
export function computeStoreCheckoutAmount({
  grossAmount,
  commissionBearer,
  commissionRate,
  minimumCommission,
  partnerCommissionType = 'percentage',
  partnerCommissionValue = 0,
  deliveryFee = 0,
  fulfillmentMethod = 'platform_collected'
}) {
  const rateBasedCommission = Math.round(grossAmount * commissionRate * 100) / 100;
  // Floored at minimumCommission, but never above grossAmount itself --
  // without that cap, a low-priced order would push netAmount negative in
  // 'vendor'-bearer mode. Commission is deliberately a pure function of
  // grossAmount only -- delivery fee never enters this base, which is what
  // keeps it structurally non-commission-bearing (a pass-through logistics
  // cost, not merchandise revenue).
  const commissionAmount = Math.min(Math.max(rateBasedCommission, minimumCommission), grossAmount);
  const bearer = commissionBearer === 'customer' ? 'customer' : 'vendor';

  // Partner-contract commission (see apps/store/src/app/api/orders/create/
  // route.js's computePaymentSplit) -- the vendor's negotiated
  // partner_contracts rate, either a percentage of grossAmount or a flat
  // amount, with no floor unlike commissionAmount's minimumCommission.
  // Clamped so the two commissions combined never exceed grossAmount; the
  // clamp always squeezes this partner portion first, never
  // commissionAmount, so that one's existing guarantee is untouched
  // either way. A flat fee larger than the order can therefore never push
  // netAmount negative.
  const rateBasedPartnerCommission = partnerCommissionType === 'flat'
    ? partnerCommissionValue
    : Math.round(grossAmount * partnerCommissionValue * 100) / 100;
  const partnerCommissionAmount = Math.max(0, Math.min(rateBasedPartnerCommission, grossAmount - commissionAmount));

  // 'platform_collected' folds the fee into what's charged/paid out here
  // (same payment as the merchandise). 'pay_on_delivery' keeps it out of
  // both entirely -- the rider collects it directly, off-platform -- and
  // is surfaced separately via payOnDeliveryAmount for the "pay on
  // arrival" UI line instead.
  const deliveryFeeAmount = fulfillmentMethod === 'platform_collected' ? deliveryFee : 0;
  const payOnDeliveryAmount = fulfillmentMethod === 'pay_on_delivery' ? deliveryFee : 0;

  // Partner commission ALWAYS comes out of the vendor's net -- never added
  // to customerAmount -- regardless of this store's own commissionBearer
  // choice for the base fee. That bearer toggle only ever governs
  // commissionAmount; a partner-attributed sale is never allowed to raise
  // the price the customer sees.
  const netAmount = (bearer === 'customer' ? grossAmount : grossAmount - commissionAmount) - partnerCommissionAmount + deliveryFeeAmount;
  const customerAmount = (bearer === 'customer' ? grossAmount + commissionAmount : grossAmount) + deliveryFeeAmount;

  return { commissionAmount, partnerCommissionAmount, netAmount, customerAmount, bearer, deliveryFeeAmount, payOnDeliveryAmount };
}
