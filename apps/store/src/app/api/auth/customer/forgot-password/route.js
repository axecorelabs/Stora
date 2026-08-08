import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { findCustomerByEmail, updateCustomer } from "@/lib/supabaseAuth";

export async function POST(request) {
  try {
    const { email } = await request.json();

    // Validation
    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Find customer
    const customer = await findCustomerByEmail(email);

    // Always return success even if customer not found (security best practice)
    if (!customer) {
      return NextResponse.json(
        { 
          success: true, 
          message: "If an account exists with this email, you will receive a password reset link shortly." 
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (15 minutes)
    await updateCustomer(customer.id, {
      password_reset_token: hashedToken,
      password_reset_expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://store.ivma.ng'}/reset-password?token=${resetToken}`;

    // Send email
    await sendPasswordResetEmail(
      customer.email,
      customer.first_name,
      resetUrl,
      15 // minutes
    );

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
