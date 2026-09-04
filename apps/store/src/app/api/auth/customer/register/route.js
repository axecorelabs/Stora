import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { recordLegalAcceptance, clearLegalReviewPending } from "@/lib/legalAcceptance";

// Same request/response contract as before this migration -- the
// frontend's signup form doesn't change at all. Internally, this now
// calls Better Auth's signUpEmail: it hashes the password (via our own
// bcrypt override in betterAuth.js), creates the customers row, creates a
// credential account row in better_auth_accounts, and -- because
// emailVerification.sendOnSignUp is enabled -- automatically emails a
// 6-digit OTP code the same way the old inline code here used to.
export async function POST(request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, password, agreeToTerms } = body;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { success: false, message: "All required fields must be provided" },
        { status: 400 }
      );
    }

    if (!agreeToTerms) {
      return NextResponse.json(
        { success: false, message: "You must agree to the Terms of Service" },
        { status: 400 }
      );
    }

    const response = await auth.api.signUpEmail({
      body: {
        email: email.toLowerCase().trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone?.trim() || undefined
      },
      asResponse: true
    });

    if (response.status !== 200) {
      const data = await response.json().catch(() => ({}));
      const message = data.code === "USER_ALREADY_EXISTS"
        ? "An account with this email already exists"
        : (data.message || "Registration failed. Please try again.");
      const status = data.code === "USER_ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json({ success: false, message }, { status });
    }

    const data = await response.json();

    // Awaited so a slow insert can't race the response back to the
    // client, but its own errors are swallowed inside the helper --
    // signup must never fail because logging did.
    await recordLegalAcceptance({
      actorType: "customer",
      actorId: data.user.id,
      documents: ["terms_of_service", "privacy_policy"],
      context: "signup",
      request
    });

    // databaseHooks.user.create.after (betterAuth.js) just flagged this
    // brand-new row as legal_review_pending_at -- clear it now that real
    // consent has actually been logged above. Non-fatal here (unlike the
    // review-and-accept route's own call to this): worst case, this
    // customer sees the review interstitial once despite having just
    // agreed via the checkbox, rather than registration itself failing.
    try {
      await clearLegalReviewPending(data.user.id);
    } catch (error) {
      console.error("Error clearing legal_review_pending_at (non-fatal):", error);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email for verification code.",
        customer: { email: data.user.email }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
