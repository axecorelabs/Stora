import { NextResponse } from "next/server";
import { createSession, sanitizeCustomer } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWelcomeEmail } from "@/lib/email";

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

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('verification_token', code)
      .gt('verification_token_expiry', new Date().toISOString())
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Verify customer
    await supabaseAdmin
      .from('customers')
      .update({
        is_verified: true,
        verification_token: null,
        verification_token_expiry: null,
      })
      .eq('id', customer.id);

    // Send welcome email
    await sendWelcomeEmail(customer.email, customer.first_name);

    // Create session
    const response = NextResponse.json(
      {
        success: true,
        message: "Email verified successfully",
        customer: sanitizeCustomer(customer),
      },
      { status: 200 }
    );

    await createSession(customer.id, request, response);

    return response;
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
