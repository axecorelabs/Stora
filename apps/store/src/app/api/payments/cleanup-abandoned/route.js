import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyTransaction } from "@/lib/paystack";
import { releaseOrderReservations, updateOrderStatus } from "@/lib/supabaseOrders";

const ABANDONED_WINDOW_MINUTES = 30;

function isAuthorized(request) {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Vercel Cron, hourly-or-more-often: releases stock reserved for orders
// whose Paystack payment was started (or never started) but never
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
    .select('id, order_id, reference')
    .eq('status', 'pending')
    .eq('method', 'paystack')
    .lt('created_at', cutoff);

  if (error) {
    console.error('Error fetching abandoned payments:', error);
    return NextResponse.json({ success: false, message: 'Failed to query abandoned payments' }, { status: 500 });
  }

  let released = 0;
  let skipped = 0;

  for (const payment of abandoned || []) {
    try {
      // Belt-and-suspenders: don't release stock for something that
      // actually succeeded but whose webhook and client-verify both
      // failed to land -- only relevant if a reference was ever issued
      // (i.e. the customer actually opened the payment popup).
      if (payment.reference) {
        const transaction = await verifyTransaction(payment.reference).catch(() => null);
        if (transaction?.status === 'success') {
          skipped++;
          continue;
        }
      }

      await releaseOrderReservations(payment.order_id);

      await supabaseAdmin
        .from('order_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      await updateOrderStatus(payment.order_id, 'cancelled');

      released++;
    } catch (cleanupError) {
      console.error(`Error cleaning up abandoned payment ${payment.id}:`, cleanupError);
    }
  }

  return NextResponse.json({ success: true, checked: (abandoned || []).length, released, skipped });
}
