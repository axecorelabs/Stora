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

// Deliberately non-enumerating: this exact message + status is returned for
// "no such account," "wrong password," "account deactivated," "Google-only
// account," and "locked out" alike -- matches the store app's customer
// login (apps/store/.../auth/customer/login/route.js), which this route
// previously didn't. A fresh NextResponse is built each call since a
// Response body can only be consumed once.
function genericInvalidCredentials() {
  return NextResponse.json(
    { success: false, message: 'Invalid email or password' },
    { status: 401 }
  );
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
      return genericInvalidCredentials();
    }

    // Check if user is active -- same generic response as everything else
    // below; a distinct message here would tell an attacker the email is
    // registered just as surely as a distinct "no account" message would.
    if (!user.is_active) {
      return genericInvalidCredentials();
    }

    // Account lockout: too many recent failed attempts for this email.
    // Response is byte-identical to the generic invalid-credentials
    // response -- locking must not create a new enumeration channel.
    if (await isLockedOut(normalizedEmail)) {
      return genericInvalidCredentials();
    }

    // Google-only account (password_hash is null). Same response and same
    // recordFailedAttempt side effect as a genuine wrong password -- naming
    // the auth method here would be a new enumeration channel.
    if (!user.password_hash) {
      await recordFailedAttempt(normalizedEmail);
      return genericInvalidCredentials();
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await recordFailedAttempt(normalizedEmail);
      return genericInvalidCredentials();
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
