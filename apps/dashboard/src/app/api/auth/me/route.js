import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get full user from Supabase
    const { data: fullUser, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !fullUser) {
      console.error('User fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: fullUser.id,
        firstName: fullUser.first_name,
        lastName: fullUser.last_name,
        email: fullUser.email,
        role: fullUser.role,
        isActive: fullUser.is_active,
        isSubscribed: fullUser.is_subscribed,
        dateSubscribed: fullUser.date_subscribed,
        currentSubscription: fullUser.current_subscription_id,
        createdAt: fullUser.created_at,
        updatedAt: fullUser.updated_at
      }
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
