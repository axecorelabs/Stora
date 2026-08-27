import { NextResponse } from 'next/server';
import { auth } from '@/lib/betterAuth';
import { verifySession } from '@/lib/auth';

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

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, message: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // revokeOtherSessions: true replicates the old code's exact
    // invalidateSessions(user.id, {exceptSessionId}) behavior -- every
    // other session for this account is revoked, the one that just
    // proved the current password stays alive.
    const result = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: req.headers,
      asResponse: true
    });

    if (result.status !== 200) {
      const data = await result.json().catch(() => ({}));
      const message = data.code === "INVALID_PASSWORD"
        ? "Current password is incorrect"
        : (data.message || "Failed to change password");
      const status = data.code === "INVALID_PASSWORD" ? 401 : 400;
      return NextResponse.json({ success: false, message }, { status });
    }

    // changePassword rotates the session token as part of the password
    // change (even with revokeOtherSessions just revoking the others) --
    // the new Set-Cookie has to be forwarded or the browser is left
    // holding a now-dead token, same pattern as signin/verify-email.
    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });
    const setCookie = result.headers.get('set-cookie');
    if (setCookie) response.headers.set('set-cookie', setCookie);
    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
