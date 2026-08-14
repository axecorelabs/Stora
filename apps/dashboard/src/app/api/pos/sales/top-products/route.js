import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

// GET - Best selling products by revenue, aggregated from completed sale_items.
// Accepts optional ?limit= (default 5) and ?days= (default 30, capped at 90).
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
    const requestedLimit = parseInt(searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const requestedDays = parseInt(searchParams.get('days'));
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(requestedDays, MAX_DAYS)
      : DEFAULT_DAYS;

    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    rangeStart.setHours(0, 0, 0, 0);

    const { data: items, error } = await supabaseAdmin
      .from('sale_items')
      .select('inventory_id, product_name, sku, quantity, total, sales!inner(user_id, status, sale_date)')
      .eq('sales.user_id', user.id)
      .eq('sales.status', 'completed')
      .gte('sales.sale_date', rangeStart.toISOString());

    if (error) {
      console.error('Top products fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch top products' },
        { status: 500 }
      );
    }

    // Aggregate per product in memory -- a single query beats one query per product.
    const byProduct = new Map();
    (items || []).forEach((item) => {
      const key = item.inventory_id || item.sku || item.product_name;
      if (!key) return;
      const existing = byProduct.get(key) || {
        inventoryId: item.inventory_id,
        productName: item.product_name,
        sku: item.sku,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += Number(item.quantity) || 0;
      existing.revenue += parseFloat(item.total || 0);
      byProduct.set(key, existing);
    });

    const products = Array.from(byProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: { products, days }
    });

  } catch (error) {
    console.error('Top products error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
