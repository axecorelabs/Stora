import { NextResponse, after } from "next/server";
import { hashPassword, findCustomerByEmail, createCustomer, generateVerificationCode } from "@/lib/supabaseAuth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, password, agreeToTerms } = body;

    // Validation
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

    // Check if customer already exists
    const existingCustomer = await findCustomerByEmail(email);

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();
    const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create customer
    const customer = await createCustomer({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      password_hash: hashedPassword,
      is_verified: false,
      verification_token: verificationCode,
      verification_token_expiry: verificationTokenExpiry.toISOString(),
    });

    // Deferred: sendVerificationEmail already swallows its own errors, so
    // waiting here bought no delivery guarantee, only latency on signup.
    after(() => sendVerificationEmail(email, firstName, verificationCode));

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email for verification code.",
        customer: { email: customer.email },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
