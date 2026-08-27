import { NextResponse, after } from "next/server";
import { auth } from "@/lib/betterAuth";
import { findCustomerByEmail, sanitizeCustomer } from "@/lib/supabaseAuth";
import { sendWelcomeEmail } from "@/lib/email";

// Same contract as before -- the frontend still posts {email, code}.
// Internally this now calls the emailOTP plugin's own verify endpoint;
// emailVerification.autoSignInAfterVerification in betterAuth.js makes it
// set the real session cookie itself, matching the old code's own
// verify-then-log-in-immediately behavior.
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const result = await auth.api.verifyEmailOTP({
      body: { email: email.toLowerCase().trim(), otp: code },
      asResponse: true
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    const customer = await findCustomerByEmail(email);

    // Deferred -- sendWelcomeEmail already swallows its own errors, so
    // waiting here bought no delivery guarantee, only latency on verify.
    after(() => sendWelcomeEmail(customer.email, customer.first_name));

    const response = NextResponse.json(
      {
        success: true,
        message: "Email verified successfully",
        customer: sanitizeCustomer(customer)
      },
      { status: 200 }
    );

    // Forward the real session cookie Better Auth just set.
    const setCookie = result.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
