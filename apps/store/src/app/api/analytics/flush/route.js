import { NextResponse } from "next/server";
import crypto from "crypto";
import { redis, NS } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";

// Timing-safe compare -- same rationale and pattern as
// api/payments/cleanup-abandoned/route.js's isAuthorized.
function isAuthorized(request) {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

// Batches whatever's accumulated in Redis (see lib/analytics.js) into
// Postgres: one upsert per store/product per day instead of one write per
// pageview. Deliberately cadence-agnostic -- each run reads-and-deletes
// whatever counter keys currently exist and adds their value on top of
// the existing daily total (ON CONFLICT DO UPDATE ... + EXCLUDED), so
// this is correct whether it runs once a day (Vercel Cron's Hobby-plan
// ceiling -- see vercel.json) or more often: a key deleted mid-day just
// starts accumulating the next delta from zero, nothing is double-counted
// or lost (aside from the vanishingly small GET/DEL race window, which is
// an acceptable trade for analytics data, unlike the atomic RPCs used
// for stock/payments elsewhere in this app). "Today so far" is always
// read live from Redis regardless (see the stats route the dashboard
// calls), so a once-daily flush never makes the numbers feel stale.
async function flushCounters(prefix) {
  const keys = await redis.keys(`${NS}:analytics:views:${prefix}:*`);
  if (keys.length === 0) return { flushed: 0, totalViews: 0 };

  let totalViews = 0;
  const rows = [];

  for (const key of keys) {
    const value = await redis.get(key);
    const views = Number(value) || 0;
    if (views <= 0) {
      await redis.del(key);
      continue;
    }

    // Key shape: store:analytics:views:{prefix}:{id}:{YYYY-MM-DD}
    const parts = key.split(':');
    const date = parts.pop();
    const id = parts.pop();

    rows.push({ id, date, views });
    totalViews += views;
    await redis.del(key);
  }

  if (rows.length === 0) return { flushed: 0, totalViews: 0 };

  const table = prefix === 'store' ? 'store_daily_views' : 'product_daily_views';
  const idColumn = prefix === 'store' ? 'store_id' : 'product_id';

  for (const row of rows) {
    const { error } = await supabaseAdmin.rpc('fn_upsert_daily_view', {
      p_table: table,
      p_id_column: idColumn,
      p_id: row.id,
      p_date: row.date,
      p_views: row.views
    });
    if (error) {
      console.error(`Error flushing ${prefix} view count for ${row.id}:`, error);
    }
  }

  return { flushed: rows.length, totalViews };
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [storeResult, productResult] = await Promise.all([
      flushCounters('store'),
      flushCounters('product')
    ]);

    return NextResponse.json({
      success: true,
      stores: storeResult,
      products: productResult
    });
  } catch (error) {
    console.error('Error flushing analytics:', error);
    return NextResponse.json({ success: false, message: 'Failed to flush analytics' }, { status: 500 });
  }
}
