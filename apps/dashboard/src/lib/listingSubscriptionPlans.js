// Single source of truth for the listing plan's 3 billing cycles --
// replaces the flat PAYSTACK_LISTING_PLAN_CODE/50000-kobo constants that
// used to be duplicated across route.js/webhook/route.js/confirm/route.js.
// Paystack has no native "every 6 months" interval; its own `biannually`
// interval means exactly that, so the 6-month Plan created in the Paystack
// dashboard should use that interval.
//
// PAYSTACK_LISTING_PLAN_CODE_MONTHLY falls back to the pre-existing
// PAYSTACK_LISTING_PLAN_CODE env var -- lets that var be renamed on its own
// schedule rather than needing a coordinated cutover with this deploy.
export const LISTING_BILLING_CYCLES = ['monthly', '6month', 'annual'];

export const LISTING_PLAN_CONFIG = {
  monthly: {
    planCode: process.env.PAYSTACK_LISTING_PLAN_CODE_MONTHLY || process.env.PAYSTACK_LISTING_PLAN_CODE || null,
    amountKobo: 50000,
    months: 1,
    label: 'Monthly'
  },
  '6month': {
    planCode: process.env.PAYSTACK_LISTING_PLAN_CODE_6MONTH || null,
    amountKobo: Number(process.env.PAYSTACK_LISTING_AMOUNT_KOBO_6MONTH || 0) || null,
    months: 6,
    label: '6 Months'
  },
  annual: {
    planCode: process.env.PAYSTACK_LISTING_PLAN_CODE_ANNUAL || null,
    amountKobo: Number(process.env.PAYSTACK_LISTING_AMOUNT_KOBO_ANNUAL || 0) || null,
    months: 12,
    label: 'Annual'
  }
};

export function isValidListingCycle(cycle) {
  return LISTING_BILLING_CYCLES.includes(cycle);
}

// Reverse lookup used by the webhook/confirm handlers: a verified Paystack
// plan_code tells us both "this is a listing payment" (a match at all) and
// which cycle it was, replacing the old flat === check against one code.
export function resolveListingCycleFromPlanCode(planCode) {
  if (!planCode) return null;
  for (const cycle of LISTING_BILLING_CYCLES) {
    if (LISTING_PLAN_CONFIG[cycle].planCode === planCode) return cycle;
  }
  return null;
}

// Calendar-month-aware (not a fixed day count) so e.g. an annual renewal
// from Jan 31 lands on the real next Jan 31/28, not 365 days later drifting
// across leap years. setDate(1) before setMonth avoids JS's own month-end
// overflow bug (Date's setMonth on the 31st rolls over into the NEXT month
// if the target month is shorter -- e.g. Jan 31 .setMonth(+1) silently
// becomes Mar 3, not Feb 28); the explicit clamp afterward then picks the
// target month's real last day when the original day doesn't exist there.
export function addBillingCycle(date, cycle) {
  const config = LISTING_PLAN_CONFIG[cycle] || LISTING_PLAN_CONFIG.monthly;
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + config.months);
  const daysInResultMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInResultMonth));
  return result;
}

// Savings vs. paying monthly for the same span, for the UI's "Save X%" badge.
export function listingCycleSavingsPercent(cycle) {
  const config = LISTING_PLAN_CONFIG[cycle];
  if (!config || !config.amountKobo || cycle === 'monthly') return 0;
  const monthlyEquivalent = LISTING_PLAN_CONFIG.monthly.amountKobo * config.months;
  return Math.max(0, Math.round((1 - config.amountKobo / monthlyEquivalent) * 100));
}
