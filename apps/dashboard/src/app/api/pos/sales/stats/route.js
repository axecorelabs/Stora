import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Helper to get date boundaries
function getDateBoundaries() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return {
    today: startOfToday.toISOString(),
    week: startOfWeek.toISOString(),
    month: startOfMonth.toISOString()
  };
}

// GET - Fetch sales statistics
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const dates = getDateBoundaries();

    // Get all stats in parallel using Supabase
    const [
      overallResult,
      todayResult,
      weekResult,
      monthResult,
      itemsCountResult
    ] = await Promise.all([
      // Overall stats
      supabaseAdmin
        .from('sales')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('status', 'completed'),
      
      // Today's stats
      supabaseAdmin
        .from('sales')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('sale_date', dates.today),
      
      // Week's stats
      supabaseAdmin
        .from('sales')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('sale_date', dates.week),
      
      // Month's stats
      supabaseAdmin
        .from('sales')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('sale_date', dates.month),
      
      // Total items sold (from sale_items)
      supabaseAdmin
        .from('sale_items')
        .select('quantity, sales!inner(user_id, status)')
        .eq('sales.user_id', user.id)
        .eq('sales.status', 'completed')
    ]);

    // Calculate stats from results
    const overallSales = overallResult.data || [];
    const todaySales = todayResult.data || [];
    const weekSales = weekResult.data || [];
    const monthSales = monthResult.data || [];
    const itemsSold = itemsCountResult.data || [];

    const calculateStats = (sales) => ({
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
      avgSaleAmount: sales.length > 0 
        ? sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0) / sales.length 
        : 0
    });

    const overallStats = calculateStats(overallSales);
    const todayStats = calculateStats(todaySales);
    const weekStats = calculateStats(weekSales);
    const monthStats = calculateStats(monthSales);
    
    const totalItemsSold = itemsSold.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        totalSales: overallStats.totalSales,
        totalRevenue: overallStats.totalRevenue,
        avgSaleAmount: overallStats.avgSaleAmount,
        totalItemsSold: totalItemsSold,
        todaySales: todayStats.totalSales,
        todayRevenue: todayStats.totalRevenue,
        weekSales: weekStats.totalSales,
        weekRevenue: weekStats.totalRevenue,
        monthSales: monthStats.totalSales,
        monthRevenue: monthStats.totalRevenue
      }
    });

  } catch (error) {
    console.error('Sales stats fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
