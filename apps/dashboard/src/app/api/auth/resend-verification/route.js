import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: tempUser } = await supabaseAdmin
      .from('temp_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!tempUser) {
      return NextResponse.json(
        { success: false, message: 'No verification request found for this email' },
        { status: 404 }
      );
    }

    // canResendCode: max 5 attempts, at least 1 minute between resends
    const canResend = tempUser.resend_count < 5 && (
      !tempUser.last_resend_at || (Date.now() - new Date(tempUser.last_resend_at).getTime()) >= 60 * 1000
    );

    if (!canResend) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please wait before requesting another code. Maximum 5 attempts allowed.'
        },
        { status: 429 }
      );
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const newResendCount = tempUser.resend_count + 1;

    const { error: updateError } = await supabaseAdmin
      .from('temp_users')
      .update({
        verification_code: newCode,
        verification_code_expires: expiresAt.toISOString(),
        resend_count: newResendCount,
        last_resend_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tempUser.id);

    if (updateError) throw updateError;

    // Send new verification email
    const emailResult = await sendVerificationEmail(tempUser.email, newCode, tempUser.first_name);

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'New verification code sent to your email',
      data: {
        email: tempUser.email,
        expiresAt: expiresAt.toISOString(),
        attemptsRemaining: 5 - newResendCount
      }
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
