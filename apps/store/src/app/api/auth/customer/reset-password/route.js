import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";

// Same contract as before -- the frontend's reset-password page already
// posts {token, password} (the raw token from the emailed link's query
// string). Better Auth's own resetPassword endpoint takes the same raw
// token, and revokeSessionsOnPasswordReset in betterAuth.js replicates
// the old code's explicit invalidateSessions(customer.id) call.
export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, message: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const response = await auth.api.resetPassword({
      body: { token, newPassword: password },
      asResponse: true
    });

    if (response.status !== 200) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset token. Please request a new password reset link." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Password reset successful! You can now sign in with your new password." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
