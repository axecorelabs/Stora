import { NextResponse, after } from "next/server";
import { auth } from "@/lib/betterAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWelcomeEmail } from "@/lib/email";

// Same contract as before -- the frontend still posts {email,
// verificationCode}. The user row and its trial subscription already
// exist by this point (created at signup, not here, now that Better Auth
// owns that step) -- this route now only verifies the code and logs the
// vendor in, via emailVerification.autoSignInAfterVerification in
// betterAuth.js.
export async function POST(req) {
  try {
    const { email, verificationCode } = await req.json();

    if (!email || !verificationCode) {
      return NextResponse.json(
        { success: false, message: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const result = await auth.api.verifyEmailOTP({
      body: { email: email.toLowerCase().trim(), otp: verificationCode },
      headers: req.headers,
      asResponse: true
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, message: "Invalid verification code or email not found" },
        { status: 400 }
      );
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Deferred -- sendWelcomeEmail never throws (returns {success:false}),
    // so waiting here bought no delivery guarantee, only verify latency.
    after(() => sendWelcomeEmail(updatedUser.email, updatedUser.first_name));

    const response = NextResponse.json({
      success: true,
      message: "Email verified successfully! Welcome to Stora!",
      user: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.is_active,
        isSubscribed: updatedUser.is_subscribed,
        dateSubscribed: updatedUser.date_subscribed,
        currentSubscription: updatedUser.current_subscription_id,
        onboardingCompletedAt: updatedUser.onboarding_completed_at,
        legalReviewPendingAt: updatedUser.legal_review_pending_at,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

    const setCookie = result.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
