import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyTransaction } from "@/lib/paystack";
import { updateOrderStatus } from "@/lib/supabaseOrders";
import { confirmOrderPayment } from "@/lib/supabasePayments";

const ABANDONED_WINDOW_MINUTES = 30;

// A transaction still in one of these states is actively resolving on
// Paystack's side (mid-OTP/3DS, or an async channel like bank transfer/
// USSD awaiting confirmation) -- cancelling now would race a payment
// that's genuinely about to succeed. That race is exactly what used to
// produce a "NEEDS RECONCILIATION" order (see confirmOrderPayment in
// supabasePayments.js): this loop would see "not success" at the moment
// it checked, cancel and release the stock, and then the real webhook
// would land a few seconds later against a reservation that no longer
// existed. Deferring here instead of cancelling closes that race for any
// case where Paystack itself can tell us the charge is still alive.
// Anything else -- success (handled separately), a genuine terminal
// failure (failed/abandoned/reversed), or a status Paystack has never
// documented to us -- is safe to treat as dead.
const STILL_PROCESSING_STATUSES = new Set(['pending', 'processing', 'ongoing', 'queued']);

// Absolute ceiling regardless of Paystack's reported status: a charge
// that's still "processing" a full day after being initiated is not
// resolving normally, and holding stock reserved for it indefinitely is
// worse than the (by now vanishingly small) risk of cancelling a real
// payment. Force-cancelled past this point gets its own flagged note
// instead of silently disappearing, same as any other reconciliation case.
const HARD_CANCEL_HOURS = 24;

// Timing-safe compare -- a plain === here would leak how many leading
// bytes of CRON_SECRET a guess got right via response-time differences,
// same class of issue the webhook signature check already guards against
// (apps/store/src/lib/paystack.js's verifyWebhookSignature).
function isAuthorized(request) {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

// Decides what to do with one abandoned-candidate payment. Pure and I/O
// free so the decision table can be verified against synthetic Paystack
// responses without needing a real in-flight transaction to test against.
//   'cancel'       -- safe to cancel now (never attempted, or Paystack
//                      confirms it's genuinely dead)
//   'skip'         -- Paystack confirms it already succeeded
//   'defer'        -- still resolving (or unverifiable); try again next run
//   'force_cancel' -- still resolving, but past the hard ceiling
export function classifyAbandonedPayment(payment, { transaction = null, verifyFailed = false } = {}) {
  if (!payment.reference) return 'cancel';

  if (transaction?.status === 'success') return 'skip';

  const stillProcessing = verifyFailed || (transaction && STILL_PROCESSING_STATUSES.has(transaction.status));
  if (stillProcessing) {
    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    return ageMs > HARD_CANCEL_HOURS * 60 * 60 * 1000 ? 'force_cancel' : 'defer';
  }

  return 'cancel';
}

// Vercel Cron (once daily on the Hobby plan -- see apps/store/vercel.json;
// an external scheduler hitting this same endpoint more often is what
// actually gets this closer to the route's ~30-minute window) plus
// whatever hits this route more frequently: releases stock reserved for
// orders whose Paystack payment was started (or never started) but never
// completed. A customer who just closes the Inline popup without paying
// triggers no webhook and no verify call, so nothing else in the system
// would ever release this reservation on its own.
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ABANDONED_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: abandoned, error } = await supabaseAdmin
    .from('order_payments')
    .select('id, order_id, reference, created_at')
    .eq('status', 'pending')
    .eq('method', 'paystack')
    .lt('created_at', cutoff);

  if (error) {
    console.error('Error fetching abandoned payments:', error);
    return NextResponse.json({ success: false, message: 'Failed to query abandoned payments' }, { status: 500 });
  }

  let released = 0;
  let confirmed = 0;
  let deferred = 0;
  let forceCancelled = 0;

  for (const payment of abandoned || []) {
    try {
      let transaction = null;
      let verifyFailed = false;
      if (payment.reference) {
        try {
          transaction = await verifyTransaction(payment.reference);
        } catch (verifyError) {
          // Couldn't reach Paystack (or it errored) -- treat as "don't
          // know" and defer, not as "must be abandoned." The old code
          // swallowed this into a silent cancel, which meant a Paystack
          // outage during this cron's run would wrongly cancel every
          // payment-attempted order it happened to check.
          console.error(`Could not verify ${payment.reference} with Paystack -- deferring:`, verifyError.message);
          verifyFailed = true;
        }
      }

      const action = classifyAbandonedPayment(payment, { transaction, verifyFailed });

      if (action === 'skip') {
        // This cron is the tab- and webhook-independent backstop: if the
        // client-side flow never ran a verify call (tab closed mid-transfer)
        // and the webhook never landed (down, misconfigured, or just lost),
        // this is the only remaining path that will ever confirm a payment
        // Paystack itself says succeeded. This used to just avoid cancelling
        // it and stop there, leaving the order stuck in 'pending' forever,
        // silently -- the same failure mode as a real incident this app
        // hit, just with a longer fuse.
        try {
          await confirmOrderPayment(payment.reference, {
            transactionId: String(transaction.id),
            amountKobo: transaction.amount
          });
          confirmed++;
        } catch (confirmError) {
          console.error(`Error confirming payment ${payment.reference} found successful during cleanup sweep:`, confirmError);
        }
        continue;
      }
      if (action === 'defer') { deferred++; continue; }

      await supabaseAdmin
        .from('order_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      // updateOrderStatus(..., 'cancelled') already releases the order's
      // reservations itself (apps/store/src/lib/supabaseOrders.js) -- an
      // earlier version of this route also called releaseOrderReservations
      // directly first, double-releasing every item and pushing
      // quantity_reserved below its real value (caught via testing).
      await updateOrderStatus(payment.order_id, 'cancelled');

      if (action === 'force_cancel') {
        forceCancelled++;
        const now = new Date().toISOString();
        const flaggedNote = `[NEEDS REVIEW] Auto-cancelled after ${HARD_CANCEL_HOURS}h even though Paystack still reported this transaction as "${transaction?.status || 'unverifiable'}" -- not a normal abandonment. If the charge later succeeds anyway, it will follow the usual payment-after-cancellation reconciliation path.`;
        const { data: currentOrder } = await supabaseAdmin.from('orders').select('admin_notes').eq('id', payment.order_id).single();
        await supabaseAdmin
          .from('orders')
          .update({ admin_notes: currentOrder?.admin_notes ? `${currentOrder.admin_notes}\n${flaggedNote}` : flaggedNote, updated_at: now })
          .eq('id', payment.order_id);
        await supabaseAdmin.from('order_timeline').insert({
          order_id: payment.order_id,
          status: 'cancelled',
          from_status: 'cancelled',
          note: flaggedNote,
          updated_by: 'system',
          timestamp: now
        });
      }

      released++;
    } catch (cleanupError) {
      console.error(`Error cleaning up abandoned payment ${payment.id}:`, cleanupError);
    }
  }

  return NextResponse.json({ success: true, checked: (abandoned || []).length, released, confirmed, deferred, forceCancelled });
}
