import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get all batches for this product
    const { data: batches, error: batchError } = await supabaseAdmin
      .from('inventory_batches')
      .select('*')
      .eq('inventory_id', id)
      .eq('user_id', user.id)
      .order('date_received', { ascending: true });

    if (batchError) {
      console.error('Batch fetch error:', batchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch batches' },
        { status: 500 }
      );
    }

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Build batch sales data
    const batchSalesData = batches.map(batch => {
      // Calculate sales data from batch quantities
      const quantitySold = batch.quantity_sold || 0;
      const totalRevenue = quantitySold * (batch.selling_price || 0);
      const totalProfit = quantitySold * ((batch.selling_price || 0) - (batch.cost_price || 0));

      return {
        batchId: batch.id,
        _id: batch.id,
        batchCode: batch.batch_code,
        quantityIn: batch.quantity_in,
        quantityRemaining: batch.quantity_remaining,
        quantitySold: batch.quantity_sold,
        status: batch.status,
        costPrice: batch.cost_price,
        sellingPrice: batch.selling_price,
        dateReceived: batch.date_received,
        expiryDate: batch.expiry_date,
        totalQuantitySold: quantitySold,
        totalRevenue,
        totalProfit,
        salesCount: 0, // We don't track individual sale records per batch in Supabase
        lastSaleDate: batch.updated_at,
        averageUnitPrice: batch.selling_price
      };
    });

    // Filter out batches with no sales data for the response
    const batchesWithSales = batchSalesData.filter(batch => 
      batch.totalQuantitySold > 0 || batch.quantitySold > 0
    );

    // If no sales data but batches exist, return all batches with calculated data
    const finalData = batchesWithSales.length > 0 ? batchesWithSales : batchSalesData;

    return NextResponse.json({
      success: true,
      data: finalData
    });

  } catch (error) {
    console.error('Batch sales analytics error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
