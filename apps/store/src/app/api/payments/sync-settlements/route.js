import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { listSettlements, listSettlementTransactions } from "@/lib/paystack";

// How far back to look for settlements on every run. Generous on purpose --
// this isn't a cursor picking up where the last run left off, it's a
// rolling window re-checked from scratch every day. That means a missed run
// (deploy outage, Paystack downtime) self-heals on the next one instead of
// silently skipping a day, and it costs nothing extra: matching an
// already-settled split is a guarded no-op (see the .eq('status','pending')
// on the update below).
const LOOKBACK_DAYS = 10;

// Same pattern as apps/store/src/app/api/payments/cleanup-abandoned/route.js.
function isAuthorized(request) {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// Paystack's settlement object -- verified against the live API/docs before
// relying on this in production, since the exact field name has drifted
// across Paystack API versions in the past. Falls back through the
// candidates rather than assuming one.
function settlementEffectiveDate(settlement) {
  return settlement.settlement_date || settlement.effective_date || settlement.paidAt || settlement.paid_at || null;
}

// Fetches every page of a Paystack list endpoint. Stops as soon as a page
// comes back shorter than perPage -- works whether or not `meta.pageCount`
// is present in the response, since that field's exact shape is one more
// thing worth confirming against a real response before trusting it alone.
async function fetchAllPages(fetchPage, perPage) {
  const all = [];
  let page = 1;
  while (true) {
    const response = await fetchPage(page);
    const pageData = response?.data || [];
    all.push(...pageData);
    if (pageData.length < perPage) break;
    page += 1;
    if (page > 50) break; // hard ceiling, avoids ever looping forever on an unexpected response shape
  }
  return all;
}

// Vercel Cron, once daily (see apps/store/vercel.json). Confirms which
// vendor payouts Paystack has actually made -- separate from and more
// trustworthy than the T+1 estimate shown before this runs (see
// apps/dashboard/src/lib/settlementSchedule.js). Every vendor subaccount
// settles independently, and Paystack doesn't push a webhook for it, so
// polling the Settlement API is the only way to know for sure.
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const fromStr = formatDate(from);
  const toStr = formatDate(to);

  // Only splits still waiting on confirmation, grouped by subaccount so
  // each vendor's settlements are only fetched once regardless of how many
  // pending splits they have. transaction_id being set is the gate for
  // "this charge actually completed" -- confirmOrderPayment only sets it
  // once Paystack confirms the charge (see apps/store/src/lib/supabasePayments.js),
  // so a split whose order never finished paying is correctly excluded
  // without re-deriving order_payments.status logic here.
  const { data: pendingSplits, error: pendingError } = await supabaseAdmin
    .from('order_payment_splits')
    .select('id, subaccount_code, order_payments!inner(transaction_id)')
    .eq('status', 'pending')
    .not('subaccount_code', 'is', null)
    .not('order_payments.transaction_id', 'is', null);

  if (pendingError) {
    console.error('Error fetching pending splits for settlement sync:', pendingError);
    return NextResponse.json({ success: false, message: 'Failed to query pending splits' }, { status: 500 });
  }

  const bySubaccount = new Map();
  for (const split of pendingSplits || []) {
    const txId = split.order_payments?.transaction_id;
    if (!txId) continue;
    if (!bySubaccount.has(split.subaccount_code)) {
      bySubaccount.set(split.subaccount_code, new Map());
    }
    // Multiple pending splits could in principle share one transaction id
    // only in the impossible case of the same split row twice -- one
    // subaccount only ever has one split per order_payment (order_payment_splits_order_store_uq),
    // so this map is 1:1 in practice, but keeping the value a list costs
    // nothing and avoids relying on that assumption holding forever.
    const txMap = bySubaccount.get(split.subaccount_code);
    if (!txMap.has(txId)) txMap.set(txId, []);
    txMap.get(txId).push(split.id);
  }

  let subaccountsChecked = 0;
  let settlementsChecked = 0;
  let splitsSettled = 0;
  const errors = [];

  for (const [subaccountCode, pendingTxMap] of bySubaccount.entries()) {
    subaccountsChecked++;
    try {
      const settlementsResponse = await listSettlements({ from: fromStr, to: toStr, subaccount: subaccountCode, perPage: 50 });
      const settlements = (settlementsResponse?.data || []).filter(s => s.status === 'success');

      for (const settlement of settlements) {
        settlementsChecked++;
        let transactions;
        try {
          transactions = await fetchAllPages(
            (page) => listSettlementTransactions(settlement.id, { page, perPage: 100 }),
            100
          );
        } catch (txError) {
          console.error(`Could not list transactions for settlement ${settlement.id} (subaccount ${subaccountCode}):`, txError.message);
          errors.push(`settlement ${settlement.id}: ${txError.message}`);
          continue;
        }

        const settledAt = settlementEffectiveDate(settlement) || new Date().toISOString();

        for (const transaction of transactions) {
          // Match on Paystack's own transaction id first (what confirmOrderPayment
          // stores as order_payments.transaction_id -- see apps/store/src/lib/supabasePayments.js),
          // falling back to reference in case a settlement-transaction object
          // ever omits id.
          const candidateIds = [transaction.id != null ? String(transaction.id) : null, transaction.reference || null].filter(Boolean);
          const matchedTxId = candidateIds.find(id => pendingTxMap.has(id));
          if (!matchedTxId) continue;

          const splitIds = pendingTxMap.get(matchedTxId);
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('order_payment_splits')
            .update({
              status: 'settled',
              settled_at: settledAt,
              paystack_settlement_id: String(settlement.id),
              updated_at: new Date().toISOString()
            })
            .in('id', splitIds)
            .eq('status', 'pending') // guards against a concurrent run already having settled this
            .select('id');

          if (updateError) {
            console.error(`Error marking splits settled for transaction ${matchedTxId}:`, updateError);
            errors.push(`transaction ${matchedTxId}: ${updateError.message}`);
            continue;
          }

          splitsSettled += (updated || []).length;
          pendingTxMap.delete(matchedTxId);
        }
      }
    } catch (subaccountError) {
      console.error(`Error syncing settlements for subaccount ${subaccountCode}:`, subaccountError.message);
      errors.push(`subaccount ${subaccountCode}: ${subaccountError.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    subaccountsChecked,
    settlementsChecked,
    splitsSettled,
    errors: errors.length > 0 ? errors : undefined
  });
}
