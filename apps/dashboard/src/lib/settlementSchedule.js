// Every vendor subaccount is created with Paystack's default settlement_schedule
// ('auto') -- see createSubaccount in this directory's paystack.js -- which pays
// out to the vendor's bank account the next business day after a successful
// charge (T+1). This estimates that date from when a payment was confirmed.
//
// Paystack doesn't publish a machine-readable Nigerian public-holiday
// calendar, so this only skips weekends -- it's a floor on the real date, not
// a guarantee (a holiday in between pushes the actual payout a day or more
// later). Once the daily settlement-sync cron confirms the real payout
// (apps/store/src/app/api/payments/sync-settlements/route.js), that
// settled_at value is the source of truth and this estimate is no longer
// shown for that transaction.
export function estimateSettlementDate(paidAtISOString) {
  if (!paidAtISOString) return null;

  const date = new Date(paidAtISOString);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCHours(0, 0, 0, 0);

  return date.toISOString();
}
