import { NextResponse } from 'next/server';
import { auth } from '@/lib/betterAuth';
import { validatePassword } from '@/lib/auth';

// Same contract as before -- the frontend posts {token, password}, and
// revokeSessionsOnPasswordReset in betterAuth.js replicates the old
// code's explicit invalidateSessions(user.id) call.
export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Reset token is missing' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password || '');
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password does not meet security requirements',
          passwordChecks: passwordValidation.checks
        },
        { status: 400 }
      );
    }

    const response = await auth.api.resetPassword({
      body: { token, newPassword: password },
      asResponse: true
    });

    if (response.status !== 200) {
      return NextResponse.json(
        { success: false, message: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset. You can now sign in.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
