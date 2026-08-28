import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { findCustomerByEmail, sanitizeCustomer, updateCustomerLastLogin } from "@/lib/supabaseAuth";
import { isLockedOut, recordFailedAttempt, clearFailedAttempts } from "@/lib/accountLockout";

// Store login is deliberately non-enumerating: this exact message + status
// is also returned for "no such customer" and "wrong password", so a
// locked-out account must not be distinguishable from either of those.
function genericInvalidCredentials() {
  return NextResponse.json(
    { success: false, message: "Invalid email or password" },
    { status: 401 }
  );
}

// Lockout stays wrapped explicitly around auth.api.signInEmail here
// (rather than a generic Better Auth hook) so its exact behavior --
// non-enumerating responses, a 15-minute window, clearing on success --
// stays identical and independently testable, the same as it always was.
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const customer = await findCustomerByEmail(email);
    if (!customer) {
      return genericInvalidCredentials();
    }

    const normalizedEmail = customer.email.toLowerCase().trim();

    if (await isLockedOut(normalizedEmail)) {
      return genericInvalidCredentials();
    }

    const result = await auth.api.signInEmail({
      body: { email: normalizedEmail, password },
      headers: request.headers,
      asResponse: true
    });

    if (result.status !== 200) {
      const data = await result.json().catch(() => ({}));

      if (data.code === "EMAIL_NOT_VERIFIED") {
        // Proving password ownership clears the counter even though the
        // verification check turned this attempt away -- matches the old
        // behavior exactly.
        await clearFailedAttempts(normalizedEmail);
        return NextResponse.json(
          {
            success: false,
            message: "Please verify your email. We've sent a new verification code to your email.",
            needsVerification: true
          },
          { status: 403 }
        );
      }

      // Wrong password, or a Google-only account with no credential
      // password set -- both fall through to the same generic response
      // and the same recordFailedAttempt side effect, same as before.
      await recordFailedAttempt(normalizedEmail);
      return genericInvalidCredentials();
    }

    await clearFailedAttempts(normalizedEmail);
    // Better Auth has no concept of last_login -- updated explicitly here,
    // same as the old code did (non-blocking; a failure here shouldn't
    // fail an otherwise-successful login).
    updateCustomerLastLogin(customer.id).catch(err => console.error('Failed to update last_login:', err));

    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        customer: sanitizeCustomer(customer)
      },
      { status: 200 }
    );

    const setCookie = result.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
