import { NextResponse } from 'next/server';
import { auth } from '@/lib/betterAuth';
import { isValidEmail } from '@/lib/auth';

// Same contract and same non-enumerating behavior as before -- Better
// Auth's own requestPasswordReset already returns success whether or not
// the account exists. betterAuth.js's sendResetPassword callback builds
// the same reset-link email as always.
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    await auth.api.requestPasswordReset({
      body: { email: email.toLowerCase().trim() }
    });

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link is on its way.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
