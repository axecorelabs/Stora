import { NextResponse } from "next/server";
import { verifyPassword, createSession, findCustomerByEmail, updateCustomer, generateVerificationCode, sanitizeCustomer } from "@/lib/supabaseAuth";
import { sendVerificationEmail } from "@/lib/email";
import { redis, failedKey, lockoutKey, withTimeout } from "@/lib/redis";

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

// Store login is deliberately non-enumerating: this exact message + status
// is also returned for "no such customer" and "wrong password", so a
// locked-out account must not be distinguishable from either of those.
// A fresh NextResponse is built each call since a Response body can only
// be consumed once.
function genericInvalidCredentials() {
  return NextResponse.json(
    { success: false, message: "Invalid email or password" },
    { status: 401 }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('Login attempt for email:', email);

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find customer
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      console.log('Customer not found:', email);
      return genericInvalidCredentials();
    }

    console.log('Customer found:', customer.id);

    const normalizedEmail = customer.email.toLowerCase().trim();

    // Account lockout: too many recent failed attempts for this email.
    // Response is byte-identical to the generic invalid-credentials
    // response above -- locking must not create a new enumeration channel.
    if (await isLockedOut(normalizedEmail)) {
      return genericInvalidCredentials();
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, customer.password_hash);

    if (!isPasswordValid) {
      console.log('Invalid password for:', email);
      await recordFailedAttempt(normalizedEmail);
      return genericInvalidCredentials();
    }

    console.log('Password verified for:', email);

    // Proving password ownership clears the counter even though the
    // is_verified check below may still turn this attempt away.
    await clearFailedAttempts(normalizedEmail);

    // Check if email is verified
    if (!customer.is_verified) {
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      await updateCustomer(customer.id, {
        verification_token: verificationCode,
        verification_token_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      
      // Send verification email
      try {
        await sendVerificationEmail(customer.email, customer.first_name, verificationCode );
        console.log('Verification email sent to:', customer.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: "Please verify your email. We've sent a new verification code to your email.",
          needsVerification: true 
        },
        { status: 403 }
      );
    }

    // Update last login
    await updateCustomer(customer.id, {
      last_login: new Date().toISOString(),
    });

    console.log('Creating session for customer:', customer.id);

    // Create response first
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        customer: sanitizeCustomer(customer)
      },
      { status: 200 }
    );

    // Create session and set cookie
    await createSession(customer.id, request, response);

    console.log('Session created and cookie set');

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
