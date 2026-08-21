import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, validatePassword, invalidateSessions } from '@/lib/auth';

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

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, password_reset_expiry')
      .eq('password_reset_token', hashedToken)
      .maybeSingle();

    if (!user || !user.password_reset_expiry || new Date(user.password_reset_expiry) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    await supabaseAdmin
      .from('users')
      .update({
        password_hash: hashedPassword,
        password_reset_token: null,
        password_reset_expiry: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // No active session to preserve here (this flow isn't authenticated) --
    // if this reset was prompted by a compromised account, every existing
    // session (including whatever an attacker was using) needs to die.
    await invalidateSessions(user.id);

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
