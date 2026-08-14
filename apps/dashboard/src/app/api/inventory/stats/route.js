import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

const LIST_LIMIT = 50;

function toLowStockItem(item) {
  return {
    id: item.id,
    _id: item.id,
    productName: item.name,
    name: item.name,
    sku: item.sku,
    category: item.category,
    quantityInStock: item.stockQuantity,
    stockQuantity: item.stockQuantity,
    minimumStock: item.minimumStock,
    reorderLevel: item.minimumStock
  };
}

function toOutOfStockItem(item) {
  return {
    id: item.id,
    _id: item.id,
    productName: item.name,
    name: item.name,
    sku: item.sku,
    category: item.category,
    quantityInStock: item.stockQuantity,
    stockQuantity: item.stockQuantity
  };
}

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Single round-trip aggregate (totals, category breakdown, low/out-of-
    // stock lists) instead of fetching the whole inventory table and
    // reducing/filtering it in JS -- see
    // apps/dashboard/supabase/migrations/20260814000004_inventory_stats_function.sql
    const { data, error: statsError } = await supabaseAdmin.rpc('fn_inventory_stats', {
      p_user_id: user.id,
      p_list_limit: LIST_LIMIT
    });

    if (statsError) {
      console.error('Inventory stats error:', statsError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    const stats = data?.[0] || {
      total_items: 0,
      total_stock_units: 0,
      total_stock_value: 0,
      total_selling_value: 0,
      active_items: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      category_stats: [],
      low_stock_items: [],
      out_of_stock_items: []
    };

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalItems: stats.total_items,
          totalStock: stats.total_stock_units,
          totalValue: stats.total_stock_value,
          totalStockValue: stats.total_stock_value,
          totalSellingValue: stats.total_selling_value,
          activeItems: stats.active_items,
          lowStockItems: stats.low_stock_count,
          lowStockCount: stats.low_stock_count,
          outOfStockItems: stats.out_of_stock_count,
          outOfStockCount: stats.out_of_stock_count
        },
        categories: stats.category_stats || [],
        lowStock: (stats.low_stock_items || []).map(toLowStockItem),
        outOfStock: (stats.out_of_stock_items || []).map(toOutOfStockItem)
      }
    });

  } catch (error) {
    console.error('Inventory stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
