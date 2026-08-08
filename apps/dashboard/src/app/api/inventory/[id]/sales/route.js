import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Helper to transform item sale data
function transformItemSale(sale) {
  if (!sale) return null;
  return {
    id: sale.id,
    _id: sale.id,
    mongoId: sale.mongo_id,
    userId: sale.user_id,
    inventoryId: sale.inventory_id,
    saleId: sale.sale_id,
    saleTransactionId: sale.sale_transaction_id,
    productName: sale.product_name,
    sku: sale.sku,
    category: sale.category,
    brand: sale.brand,
    unitOfMeasure: sale.unit_of_measure,
    quantitySold: sale.quantity_sold,
    unitSalePrice: sale.unit_sale_price,
    totalSaleAmount: sale.total_sale_amount,
    unitCostPrice: sale.unit_cost_price,
    totalCostAmount: sale.total_cost_amount,
    totalBatchCost: sale.total_batch_cost,
    weightedAverageCost: sale.weighted_average_cost,
    batchCount: sale.batch_count,
    paymentMethod: sale.payment_method,
    customerName: sale.customer_name,
    customerPhone: sale.customer_phone,
    customerEmail: sale.customer_email,
    saleDate: sale.sale_date,
    status: sale.status,
    soldBy: sale.sold_by,
    saleLocation: sale.sale_location,
    notes: sale.notes,
    createdAt: sale.created_at,
    updatedAt: sale.updated_at
  };
}

export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id: inventoryId } = await params;
    const { searchParams } = new URL(req.url);
    
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 25;
    const batchId = searchParams.get('batchId');
    
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('item_sales')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('inventory_id', inventoryId)
      .eq('status', 'completed')
      .order('sale_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Note: batchId filtering would require the batch data to be stored differently in Supabase
    // For now, we'll skip this filter as the schema doesn't have batch references in item_sales

    const { data: sales, error, count } = await query;

    if (error) {
      console.error('Error fetching item sales:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch sales' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sales: (sales || []).map(transformItemSale),
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching item sales:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
