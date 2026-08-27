import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { supabaseAdmin } from "@/lib/supabase";

// Same contract as before -- calls the emailOTP plugin's own resend
// endpoint, which generates a fresh code and re-sends via the
// sendVerificationOTP callback in betterAuth.js (same sendVerificationEmail
// helper as always). The old lifetime cap (5 resends, 1-minute cooldown,
// tracked on the now-retired temp_users row) is superseded by the
// emailOTP plugin's own built-in per-endpoint rate limiting.
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_email_verified')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "No verification request found for this email" },
        { status: 404 }
      );
    }
    if (user.is_email_verified) {
      return NextResponse.json(
        { success: false, message: "This account is already verified" },
        { status: 400 }
      );
    }

    await auth.api.sendVerificationOTP({
      body: { email: normalizedEmail, type: "email-verification" }
    });

    return NextResponse.json({
      success: true,
      message: "New verification code sent to your email",
      data: { email: normalizedEmail }
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
