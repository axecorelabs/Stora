// Full-store's own 4-cycle plan registry -- same pattern as
// listingSubscriptionPlans.js, parameterized for this product instead.
// Kept as a separate (near-identical) module rather than a shared one:
// the two products' cycles/pricing/env-var names genuinely differ (4
// cycles here vs 3 for listing), and this mirrors this codebase's own
// existing convention of small per-product duplication over a shared
// abstraction for a handful of lines (see storeSlug.js across apps).
//
// PAYSTACK_FULL_STORE_PLAN_CODE_MONTHLY falls back to the pre-existing
// PAYSTACK_FULL_STORE_PLAN_CODE/PAYSTACK_FULL_STORE_AMOUNT_KOBO env vars.
// Paystack's native intervals map cleanly: 3month -> quarterly,
// 6month -> biannually, annual -> annually.
export const FULL_STORE_BILLING_CYCLES = ['monthly', '3month', '6month', 'annual'];

export const FULL_STORE_PLAN_CONFIG = {
  monthly: {
    planCode: process.env.PAYSTACK_FULL_STORE_PLAN_CODE_MONTHLY || process.env.PAYSTACK_FULL_STORE_PLAN_CODE || null,
    amountKobo: Number(process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO_MONTHLY || process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO || 0) || null,
    months: 1,
    label: 'Monthly'
  },
  '3month': {
    planCode: process.env.PAYSTACK_FULL_STORE_PLAN_CODE_3MONTH || null,
    amountKobo: Number(process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO_3MONTH || 0) || null,
    months: 3,
    label: '3 Months'
  },
  '6month': {
    planCode: process.env.PAYSTACK_FULL_STORE_PLAN_CODE_6MONTH || null,
    amountKobo: Number(process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO_6MONTH || 0) || null,
    months: 6,
    label: '6 Months'
  },
  annual: {
    planCode: process.env.PAYSTACK_FULL_STORE_PLAN_CODE_ANNUAL || null,
    amountKobo: Number(process.env.PAYSTACK_FULL_STORE_AMOUNT_KOBO_ANNUAL || 0) || null,
    months: 12,
    label: 'Annual'
  }
};

export function isValidFullStoreCycle(cycle) {
  return FULL_STORE_BILLING_CYCLES.includes(cycle);
}

export function resolveFullStoreCycleFromPlanCode(planCode) {
  if (!planCode) return null;
  for (const cycle of FULL_STORE_BILLING_CYCLES) {
    if (FULL_STORE_PLAN_CONFIG[cycle].planCode === planCode) return cycle;
  }
  return null;
}

// Calendar-month-aware, same month-end-overflow-safe approach as
// listingSubscriptionPlans.js's addBillingCycle (setDate(1) before
// setMonth avoids e.g. Jan 31 + 1 month silently becoming Mar 3; the
// clamp afterward picks the real last day of the target month instead).
export function addBillingCycle(date, cycle) {
  const config = FULL_STORE_PLAN_CONFIG[cycle] || FULL_STORE_PLAN_CONFIG.monthly;
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + config.months);
  const daysInResultMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInResultMonth));
  return result;
}

// Savings vs. paying monthly for the same span, for the UI's "Save X%" badge.
export function fullStoreCycleSavingsPercent(cycle) {
  const config = FULL_STORE_PLAN_CONFIG[cycle];
  if (!config || !config.amountKobo || cycle === 'monthly') return 0;
  const monthlyEquivalent = FULL_STORE_PLAN_CONFIG.monthly.amountKobo * config.months;
  if (!monthlyEquivalent) return 0;
  return Math.max(0, Math.round((1 - config.amountKobo / monthlyEquivalent) * 100));
}
