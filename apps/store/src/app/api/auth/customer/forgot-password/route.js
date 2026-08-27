import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";

// Same contract and same non-enumerating behavior as before -- Better
// Auth's own requestPasswordReset already returns the identical generic
// success response whether or not the account exists, so no extra lookup
// is needed here. betterAuth.js's sendResetPassword callback builds the
// same reset-link email as always.
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    await auth.api.requestPasswordReset({
      body: { email: email.toLowerCase().trim() }
    });

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists with this email, you will receive a password reset link shortly."
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
