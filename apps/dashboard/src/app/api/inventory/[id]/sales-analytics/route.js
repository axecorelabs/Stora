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

    const { id: inventoryId } = await params;

    if (!inventoryId) {
      return NextResponse.json(
        { success: false, message: 'Inventory ID is required' },
        { status: 400 }
      );
    }

    // Get all sales for this inventory item
    const { data: salesData, error: salesError } = await supabaseAdmin
      .from('item_sales')
      .select('*')
      .eq('user_id', user.id)
      .eq('inventory_id', inventoryId)
      .in('status', ['completed', 'partially_refunded']);

    if (salesError) {
      console.error('Sales fetch error:', salesError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch sales data' },
        { status: 500 }
      );
    }

    const sales = salesData || [];

    // Calculate analytics
    let analytics = {
      totalQuantitySold: 0,
      totalRevenue: 0,
      totalProfit: 0,
      salesCount: sales.length,
      averageUnitPrice: 0,
      minUnitPrice: 0,
      maxUnitPrice: 0,
      lastSaleDate: null,
      firstSaleDate: null,
      totalRefunded: 0
    };

    if (sales.length > 0) {
      const unitPrices = sales.map(s => s.unit_sale_price || 0).filter(p => p > 0);
      
      analytics = {
        totalQuantitySold: sales.reduce((sum, s) => sum + (s.quantity_sold || 0), 0),
        totalRevenue: sales.reduce((sum, s) => sum + (s.total_sale_amount || 0), 0),
        totalProfit: sales.reduce((sum, s) => {
          const revenue = s.total_sale_amount || 0;
          const cost = s.total_cost_amount || 0;
          return sum + (revenue - cost);
        }, 0),
        salesCount: sales.length,
        averageUnitPrice: unitPrices.length > 0 ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length : 0,
        minUnitPrice: unitPrices.length > 0 ? Math.min(...unitPrices) : 0,
        maxUnitPrice: unitPrices.length > 0 ? Math.max(...unitPrices) : 0,
        lastSaleDate: sales.length > 0 ? sales.reduce((latest, s) => {
          const saleDate = new Date(s.sale_date);
          return saleDate > latest ? saleDate : latest;
        }, new Date(0)) : null,
        firstSaleDate: sales.length > 0 ? sales.reduce((earliest, s) => {
          const saleDate = new Date(s.sale_date);
          return saleDate < earliest ? saleDate : earliest;
        }, new Date()) : null,
        totalRefunded: 0 // Would need refund data tracking
      };
    }

    // Calculate monthly sales trend
    const monthlySales = {};
    sales.forEach(sale => {
      const date = new Date(sale.sale_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlySales[key]) {
        monthlySales[key] = {
          _id: { year: date.getFullYear(), month: date.getMonth() + 1 },
          quantitySold: 0,
          revenue: 0,
          salesCount: 0
        };
      }
      
      monthlySales[key].quantitySold += sale.quantity_sold || 0;
      monthlySales[key].revenue += sale.total_sale_amount || 0;
      monthlySales[key].salesCount += 1;
    });

    const monthlySalesArray = Object.values(monthlySales)
      .sort((a, b) => {
        if (a._id.year !== b._id.year) return a._id.year - b._id.year;
        return a._id.month - b._id.month;
      })
      .slice(-12);

    // Calculate payment method breakdown
    const paymentMethodBreakdown = {};
    sales.forEach(sale => {
      const method = sale.payment_method || 'unknown';
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = {
          _id: method,
          quantitySold: 0,
          revenue: 0,
          salesCount: 0
        };
      }
      paymentMethodBreakdown[method].quantitySold += sale.quantity_sold || 0;
      paymentMethodBreakdown[method].revenue += sale.total_sale_amount || 0;
      paymentMethodBreakdown[method].salesCount += 1;
    });

    // Get recent sales (last 10)
    const recentSales = sales
      .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
      .slice(0, 10)
      .map(s => ({
        quantitySold: s.quantity_sold,
        unitSalePrice: s.unit_sale_price,
        totalSaleAmount: s.total_sale_amount,
        paymentMethod: s.payment_method,
        saleDate: s.sale_date,
        customer: { name: s.customer_name }
      }));

    // Calculate additional metrics
    const netRevenue = analytics.totalRevenue - analytics.totalRefunded;
    const averageTransactionValue = analytics.salesCount > 0 ? analytics.totalRevenue / analytics.salesCount : 0;
    const averageQuantityPerSale = analytics.salesCount > 0 ? analytics.totalQuantitySold / analytics.salesCount : 0;

    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        netRevenue,
        averageTransactionValue,
        averageQuantityPerSale,
        monthlySales: monthlySalesArray,
        paymentMethodBreakdown: Object.values(paymentMethodBreakdown),
        recentSales,
        hasSalesData: analytics.salesCount > 0
      }
    });

  } catch (error) {
    console.error('Sales analytics fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
