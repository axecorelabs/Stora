import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';
import { getTodayLagosBounds } from '@/lib/deliveryValidation';

// Telegram's documented ceiling is ~30 messages/second across different
// chats -- batching keeps every run comfortably under that regardless of
// how many vendors have deliveries today, without needing an external
// queue or per-message throttling logic.
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

// Triggered externally by cron-job.org (not Vercel Cron -- see this
// repo's other cron jobs in apps/store/vercel.json for that alternative
// pattern), once daily, ~07:00 Africa/Lagos. Same timing-safe
// Bearer-token check apps/store's own cron routes use.
function isAuthorized(request) {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.DELIVERY_NOTIFICATION_CRON_SECRET}`;
  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

function formatTimeSlot(slot) {
  const labels = { anytime: 'Anytime', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  return labels[slot] || slot || 'Anytime';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0);
}

function buildDigestMessage(storeName, deliveries) {
  const lines = [...deliveries]
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .map((d, i) => {
      const location = [d.address_city, d.address_state].filter(Boolean).join(', ') || d.full_address || 'No address on file';
      return `${i + 1}. <b>${d.customer_name || 'Customer'}</b> -- ${formatTimeSlot(d.time_slot)}\n   📍 ${location}\n   💰 ${formatCurrency(d.total_amount)}`;
    });

  const count = deliveries.length;
  return `🚚 <b>${count} ${count === 1 ? 'delivery' : 'deliveries'} scheduled today</b> -- ${storeName}\n\n${lines.join('\n\n')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Batches at BATCH_SIZE could still run long at real scale (thousands of
// vendors); this is the ceiling for however far that's allowed to run
// before Vercel cuts it off, not an expectation it'll ever take this long
// at current volume.
export const maxDuration = 60;

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { start, end } = getTodayLagosBounds();

  // One query for every vendor's deliveries today, not one query per
  // vendor -- the actual scalability question this feature was built
  // around. Grouped by user_id below in memory, which is O(n) and cheap
  // even at thousands of rows.
  const { data: deliveries, error } = await supabaseAdmin
    .from('delivery_schedules')
    .select('user_id, scheduled_date, time_slot, customer_name, address_city, address_state, full_address, total_amount')
    .eq('status', 'scheduled')
    .gte('scheduled_date', start.toISOString())
    .lt('scheduled_date', end.toISOString());

  if (error) {
    console.error("Delivery digest: failed to fetch today's deliveries:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch deliveries' }, { status: 500 });
  }

  const deliveriesByOwnerId = new Map();
  for (const delivery of deliveries || []) {
    if (!deliveriesByOwnerId.has(delivery.user_id)) deliveriesByOwnerId.set(delivery.user_id, []);
    deliveriesByOwnerId.get(delivery.user_id).push(delivery);
  }

  const ownerIds = [...deliveriesByOwnerId.keys()];
  let sent = 0;
  let skippedNoChat = 0;
  let skippedNotOptedIn = 0;
  let skippedAlreadySent = 0;
  let failed = 0;

  if (ownerIds.length > 0) {
    // One batched lookup for every vendor who actually has something to
    // report today, not a per-vendor fetch.
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('owner_id, store_name, telegram_chat_id, delivery_digest_enabled, last_delivery_digest_sent_at')
      .in('owner_id', ownerIds);

    if (storesError) {
      console.error('Delivery digest: failed to fetch stores:', storesError);
      return NextResponse.json({ success: false, message: 'Failed to fetch stores' }, { status: 500 });
    }

    const sendable = (stores || []).filter((store) => {
      if (!store.telegram_chat_id) {
        skippedNoChat++;
        return false;
      }
      // Opt-in only -- connecting Telegram alone (used for order
      // notifications) doesn't enroll a vendor in this separate daily
      // message, see api/stores/delivery-digest's own comment.
      if (!store.delivery_digest_enabled) {
        skippedNotOptedIn++;
        return false;
      }
      // Idempotency guard -- a cron-job.org retry or a manual re-trigger
      // the same day must not send a second digest to a vendor already
      // covered by this run (or an earlier run today).
      if (store.last_delivery_digest_sent_at && new Date(store.last_delivery_digest_sent_at) >= start) {
        skippedAlreadySent++;
        return false;
      }
      return true;
    });

    for (let i = 0; i < sendable.length; i += BATCH_SIZE) {
      const batch = sendable.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((store) => sendTelegramMessage(
          store.telegram_chat_id,
          buildDigestMessage(store.store_name || 'Your store', deliveriesByOwnerId.get(store.owner_id))
        ))
      );

      // One vendor's send failing (bot blocked, stale chat_id) can't take
      // the rest of the batch down with it.
      const successfulOwnerIds = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sent++;
          successfulOwnerIds.push(batch[index].owner_id);
        } else {
          failed++;
          console.error(`Delivery digest: failed to send to store ${batch[index].owner_id}:`, result.reason?.message);
        }
      });

      if (successfulOwnerIds.length > 0) {
        await supabaseAdmin
          .from('stores')
          .update({ last_delivery_digest_sent_at: new Date().toISOString() })
          .in('owner_id', successfulOwnerIds);
      }

      if (i + BATCH_SIZE < sendable.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  }

  return NextResponse.json({
    success: true,
    vendorsWithDeliveriesToday: ownerIds.length,
    sent,
    skippedNoChat,
    skippedNotOptedIn,
    skippedAlreadySent,
    failed
  });
}
