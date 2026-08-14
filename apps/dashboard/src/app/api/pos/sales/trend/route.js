import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

function dayKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// GET - Daily revenue + order count for the trailing N days (for trend charts).
// Accepts an optional ?days= param (default 14, capped at 90) so callers like
// the Reports page can request a longer window than the dashboard overview.
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedDays = parseInt(searchParams.get('days'));
    const DAYS = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(requestedDays, MAX_DAYS)
      : DEFAULT_DAYS;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rangeStart = new Date(startOfToday);
    rangeStart.setDate(rangeStart.getDate() - (DAYS - 1));

    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('total, sale_date')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('sale_date', rangeStart.toISOString());

    if (error) {
      console.error('Sales trend fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch sales trend' },
        { status: 500 }
      );
    }

    // Seed every day in the range so gaps show as zero, not a missing point
    const buckets = new Map();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { date: dayKey(d), revenue: 0, orders: 0 });
    }

    (sales || []).forEach((sale) => {
      const key = dayKey(new Date(sale.sale_date));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue += parseFloat(sale.total || 0);
        bucket.orders += 1;
      }
    });

    return NextResponse.json({
      success: true,
      data: { days: Array.from(buckets.values()) }
    });

  } catch (error) {
    console.error('Sales trend error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
