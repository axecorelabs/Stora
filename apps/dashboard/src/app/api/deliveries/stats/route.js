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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const [todayResult, overdueResult, scheduledResult, completedResult] = await Promise.all([
      supabaseAdmin.from('delivery_schedules').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('scheduled_date', startOfToday).lte('scheduled_date', endOfToday),
      supabaseAdmin.from('delivery_schedules').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'scheduled').lt('scheduled_date', now.toISOString()),
      supabaseAdmin.from('delivery_schedules').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'scheduled'),
      supabaseAdmin.from('delivery_schedules').select('total_amount')
        .eq('user_id', user.id).eq('status', 'delivered')
        .gte('delivered_at', startOfMonth).lte('delivered_at', endOfMonth)
    ]);

    const completedDeliveries = completedResult.data || [];

    const stats = {
      todayDeliveries: todayResult.count || 0,
      overdueDeliveries: overdueResult.count || 0,
      scheduledDeliveries: scheduledResult.count || 0,
      completedDeliveries: completedDeliveries.length,
      totalRevenue: completedDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Delivery stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
