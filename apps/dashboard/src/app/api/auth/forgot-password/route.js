import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidEmail } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link is on its way.'
    };

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, first_name, email, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Always return the same response, whether or not the account exists
    if (!user || !user.is_active) {
      return NextResponse.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await supabaseAdmin
      .from('users')
      .update({
        password_reset_token: hashedToken,
        password_reset_expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Deferred -- sendPasswordResetEmail never throws (returns
    // {success:false}), so waiting here bought no delivery guarantee,
    // only latency on a high-frequency auth route.
    after(() => sendPasswordResetEmail(user.email, resetToken, user.first_name));

    return NextResponse.json(genericResponse);

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
