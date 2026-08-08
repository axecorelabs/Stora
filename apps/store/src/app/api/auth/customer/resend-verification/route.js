import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateVerificationCode } from "@/lib/supabaseAuth";
import { sendVerificationEmail } from "@/lib/email";

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

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_verified', false)
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found or already verified" },
        { status: 404 }
      );
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const verificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await supabaseAdmin
      .from('customers')
      .update({
        verification_token: verificationCode,
        verification_token_expiry: verificationTokenExpiry.toISOString(),
      })
      .eq('id', customer.id);

    // Send verification email
    await sendVerificationEmail(email, customer.first_name, verificationCode);

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent successfully",
      },
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
