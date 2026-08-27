import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { findCustomerByEmail } from "@/lib/supabaseAuth";

// Same contract as before -- calls the emailOTP plugin's own resend
// endpoint, which generates a fresh code and re-sends via the
// sendVerificationOTP callback in betterAuth.js (same sendVerificationEmail
// helper as always).
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const customer = await findCustomerByEmail(email);
    if (!customer || customer.is_verified) {
      return NextResponse.json(
        { success: false, message: "Customer not found or already verified" },
        { status: 404 }
      );
    }

    await auth.api.sendVerificationOTP({
      body: { email: email.toLowerCase().trim(), type: "email-verification" }
    });

    return NextResponse.json(
      { success: true, message: "Verification code sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to resend verification code" },
      { status: 500 }
    );
  }
}
