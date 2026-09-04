import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { validatePassword } from "@/lib/auth";
import { recordLegalAcceptance, clearLegalReviewPending } from "@/lib/legalAcceptance";

// Same request/response contract as before -- the frontend's signup form
// doesn't change. Internally this now calls Better Auth's signUpEmail,
// which creates the users row immediately (unverified) instead of the old
// temp_users staging step -- the trial subscription that used to be
// created at verify-email time now happens automatically via the
// databaseHooks.user.create.after hook in betterAuth.js, which fires the
// moment this row lands, regardless of signup method.
export async function POST(req) {
  try {
    const userData = await req.json();
    const normalizedEmail = userData.email.toLowerCase().trim();

    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Password does not meet security requirements",
          passwordChecks: passwordValidation.checks
        },
        { status: 400 }
      );
    }

    // The signup form (SignUp.js) has always collected this checkbox, but
    // this route never validated it server-side -- a request that skipped
    // the client-side check entirely could create an account with no
    // agreement recorded at all.
    if (!userData.agreeToTerms) {
      return NextResponse.json(
        { success: false, message: "You must agree to the Terms of Service" },
        { status: 400 }
      );
    }

    const response = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password: userData.password,
        name: `${userData.firstName?.trim() || ''} ${userData.lastName?.trim() || ''}`.trim()
      },
      asResponse: true
    });

    if (response.status !== 200) {
      const data = await response.json().catch(() => ({}));
      const message = data.code === "USER_ALREADY_EXISTS"
        ? "User already exists with this email"
        : (data.message || "Signup failed. Please try again.");
      const status = data.code === "USER_ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json({ success: false, message }, { status });
    }

    const data = await response.json();

    // Awaited so a slow insert can't race the response back to the
    // client, but its own errors are swallowed inside the helper --
    // signup must never fail because logging did.
    await recordLegalAcceptance({
      actorType: "vendor_user",
      actorId: data.user.id,
      documents: ["terms_of_service", "privacy_policy"],
      context: "signup",
      request: req
    });

    // databaseHooks.user.create.after (betterAuth.js) just flagged this
    // brand-new row as legal_review_pending_at -- clear it now that real
    // consent has actually been logged above. Non-fatal here (unlike the
    // review-and-accept route's own call to this): worst case, this vendor
    // sees the review interstitial once despite having just agreed via the
    // checkbox, rather than signup itself failing.
    try {
      await clearLegalReviewPending(data.user.id);
    } catch (error) {
      console.error("Error clearing legal_review_pending_at (non-fatal):", error);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
      data: {
        email: normalizedEmail,
        canResend: true
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
