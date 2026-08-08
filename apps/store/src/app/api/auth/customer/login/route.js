import { NextResponse } from "next/server";
import { verifyPassword, createSession, findCustomerByEmail, updateCustomer, generateVerificationCode, sanitizeCustomer } from "@/lib/supabaseAuth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('Login attempt for email:', email);

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find customer
    const customer = await findCustomerByEmail(email);

    if (!customer) {
      console.log('Customer not found:', email);
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log('Customer found:', customer.id);

    // Verify password
    const isPasswordValid = await verifyPassword(password, customer.password_hash);

    if (!isPasswordValid) {
      console.log('Invalid password for:', email);
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log('Password verified for:', email);

    // Check if email is verified
    if (!customer.is_verified) {
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      await updateCustomer(customer.id, {
        verification_token: verificationCode,
        verification_token_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      
      // Send verification email
      try {
        await sendVerificationEmail(customer.email, customer.first_name, verificationCode );
        console.log('Verification email sent to:', customer.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: "Please verify your email. We've sent a new verification code to your email.",
          needsVerification: true 
        },
        { status: 403 }
      );
    }

    // Update last login
    await updateCustomer(customer.id, {
      last_login: new Date().toISOString(),
    });

    console.log('Creating session for customer:', customer.id);

    // Create response first
    const response = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        customer: sanitizeCustomer(customer)
      },
      { status: 200 }
    );

    // Create session and set cookie
    await createSession(customer.id, request, response);

    console.log('Session created and cookie set');

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
