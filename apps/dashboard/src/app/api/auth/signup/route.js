import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, validatePassword } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const userData = await req.json();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const normalizedEmail = userData.email.toLowerCase().trim();

    // Check if user already exists in main users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // Validate + hash password
    const passwordValidation = validatePassword(userData.password);
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
    const hashedPassword = await hashPassword(userData.password);

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Replace any existing pending signup for this email
    await supabaseAdmin.from('temp_users').delete().eq('email', normalizedEmail);

    const { data: tempUser, error } = await supabaseAdmin
      .from('temp_users')
      .insert({
        id: crypto.randomUUID(),
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: normalizedEmail,
        password: hashedPassword,
        verification_code: verificationCode,
        verification_code_expires: verificationCodeExpires.toISOString(),
        resend_count: 0,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Deferred -- sendVerificationEmail already swallows its own errors
    // (returns {success:false}, never throws), so waiting here bought no
    // delivery guarantee, only signup latency.
    after(() => sendVerificationEmail(tempUser.email, tempUser.verification_code, tempUser.first_name));

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: tempUser.email,
        expiresAt: tempUser.verification_code_expires,
        canResend: true // fresh signup, always eligible
      }
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === '23505') { // unique_violation
      return NextResponse.json(
        { success: false, message: 'A verification request already exists for this email' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
