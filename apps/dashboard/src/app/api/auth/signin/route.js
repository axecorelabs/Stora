import { NextResponse } from 'next/server';
import { verifyPassword, createSession, isValidEmail } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redis, failedKey, lockoutKey, withTimeout } from '@/lib/redis';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

async function isLockedOut(email) {
  try {
    return Boolean(await withTimeout(redis.get(lockoutKey(email))));
  } catch (error) {
    console.error('Lockout check failed, allowing request:', error);
    return false;
  }
}

async function recordFailedAttempt(email) {
  try {
    const attempts = await withTimeout(redis.incr(failedKey(email)));
    if (attempts === 1) {
      await withTimeout(redis.expire(failedKey(email), LOCKOUT_WINDOW_SECONDS));
    }
    if (attempts >= LOCKOUT_THRESHOLD) {
      await withTimeout(redis.set(lockoutKey(email), '1', { ex: LOCKOUT_WINDOW_SECONDS }));
    }
  } catch (error) {
    console.error('Failed-attempt tracking failed, skipping:', error);
  }
}

async function clearFailedAttempts(email) {
  try {
    await withTimeout(redis.del(failedKey(email), lockoutKey(email)));
  } catch (error) {
    console.error('Failed-attempt cleanup failed, skipping:', error);
  }
}

export async function POST(req) {
  try {
    const { email, password, rememberMe } = await req.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No account found with this email address',
          errorType: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { success: false, message: 'Account is deactivated' },
        { status: 401 }
      );
    }

    // Account lockout: too many recent failed attempts for this email
    if (await isLockedOut(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Too many failed attempts. Please try again in 15 minutes.' },
        { status: 423 }
      );
    }

    // Google-only account (password_hash is null) -- dashboard already
    // enumerates account existence via the 404/401 split above, so naming
    // the auth method here costs nothing new and avoids a dead-end "wrong
    // password" loop for a user who never had a password.
    if (!user.password_hash) {
      return NextResponse.json(
        { success: false, message: 'This account uses Google Sign-In. Please continue with Google.', errorType: 'GOOGLE_ONLY_ACCOUNT' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await recordFailedAttempt(normalizedEmail);
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }

    await clearFailedAttempts(normalizedEmail);

    // Update last login (non-blocking)
    supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});

    // Create session
    const response = NextResponse.json({
      success: true,
      message: 'Signed in successfully',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        onboardingCompletedAt: user.onboarding_completed_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login
      }
    });

    await createSession(user.id, req, response);

    return response;

  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
