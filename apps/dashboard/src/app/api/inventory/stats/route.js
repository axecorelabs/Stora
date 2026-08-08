import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get all inventory items for this user
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('user_id', user.id);

    if (invError) {
      console.error('Inventory fetch error:', invError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch inventory' },
        { status: 500 }
      );
    }

    const items = inventory || [];

    // Calculate overview stats
    const totalItems = items.length;
    const totalStock = items.reduce((sum, item) => sum + (item.stock_quantity || 0), 0);
    const totalStockValue = items.reduce((sum, item) => sum + ((item.stock_quantity || 0) * (item.cost || 0)), 0);
    const totalSellingValue = items.reduce((sum, item) => sum + ((item.stock_quantity || 0) * (item.base_price || 0)), 0);
    const activeItems = items.filter(item => item.is_active).length;

    // Calculate low stock and out of stock
    const lowStockItems = items.filter(item => 
      item.stock_quantity > 0 && 
      item.stock_quantity <= (item.minimum_stock || 5)
    ).map(item => ({
      id: item.id,
      _id: item.id,
      productName: item.name,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantityInStock: item.stock_quantity,
      stockQuantity: item.stock_quantity,
      minimumStock: item.minimum_stock,
      reorderLevel: item.minimum_stock
    }));

    const outOfStockItems = items.filter(item => 
      (item.stock_quantity || 0) <= 0
    ).map(item => ({
      id: item.id,
      _id: item.id,
      productName: item.name,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantityInStock: item.stock_quantity,
      stockQuantity: item.stock_quantity
    }));

    // Calculate category stats
    const categoryMap = {};
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          count: 0,
          totalStock: 0,
          totalValue: 0
        };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].totalStock += item.stock_quantity || 0;
      categoryMap[cat].totalValue += (item.stock_quantity || 0) * (item.cost || 0);
    });

    const categoryStats = Object.values(categoryMap);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalItems,
          totalStock,
          totalValue: totalStockValue,
          totalStockValue,
          totalSellingValue,
          activeItems,
          lowStockItems: lowStockItems.length,
          lowStockCount: lowStockItems.length,
          outOfStockItems: outOfStockItems.length,
          outOfStockCount: outOfStockItems.length
        },
        categories: categoryStats,
        lowStock: lowStockItems,
        outOfStock: outOfStockItems
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
