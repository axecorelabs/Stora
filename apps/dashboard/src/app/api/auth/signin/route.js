import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { isValidEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isLockedOut, recordFailedAttempt, clearFailedAttempts } from "@/lib/accountLockout";

// Deliberately non-enumerating: this exact message + status is returned for
// "no such account," "wrong password," "account deactivated," "Google-only
// account," "not yet verified," and "locked out" alike.
function genericInvalidCredentials() {
  return NextResponse.json(
    { success: false, message: 'Invalid email or password' },
    { status: 401 }
  );
}

// Lockout stays wrapped explicitly around auth.api.signInEmail here
// (rather than a generic Better Auth hook) so its exact behavior stays
// identical and independently testable, the same as it always was.
export async function POST(req) {
  try {
    const { email, password } = await req.json();

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

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (!user || !user.is_active) {
      return genericInvalidCredentials();
    }

    if (await isLockedOut(normalizedEmail)) {
      return genericInvalidCredentials();
    }

    const result = await auth.api.signInEmail({
      body: { email: normalizedEmail, password },
      headers: req.headers,
      asResponse: true
    });

    if (result.status !== 200) {
      const data = await result.json().catch(() => ({}));

      if (data.code === "EMAIL_NOT_VERIFIED") {
        await clearFailedAttempts(normalizedEmail);
        return NextResponse.json(
          {
            success: false,
            message: "Please verify your email before signing in. We've sent a new verification code.",
            needsVerification: true
          },
          { status: 403 }
        );
      }

      await recordFailedAttempt(normalizedEmail);
      return genericInvalidCredentials();
    }

    await clearFailedAttempts(normalizedEmail);
    // Better Auth doesn't track last_login -- updated explicitly, same as
    // the old code did (non-blocking).
    supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});

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
        legalReviewPendingAt: user.legal_review_pending_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLogin: user.last_login
      }
    });

    const setCookie = result.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
