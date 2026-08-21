import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession, verifyPassword, hashPassword, getSessionIdFromRequest, invalidateSessions } from '@/lib/auth';

export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Get full user with password
    const { data: fullUser, error } = await supabaseAdmin
      .from('users')
      .select('id, password_hash')
      .eq('id', user.id)
      .single();

    if (error || !fullUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, fullUser.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Validate new password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if new password is same as current
    const isSamePassword = await verifyPassword(newPassword, fullUser.password_hash);
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, message: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Every other session for this account is now revoked -- a stolen
    // session cookie must not survive a password change. The session that
    // just proved the current password stays alive, so changing your own
    // password doesn't immediately log you out.
    await invalidateSessions(user.id, { exceptSessionId: getSessionIdFromRequest(req) });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);

    if (error.message?.includes('security requirements')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
