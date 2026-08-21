import { NextResponse } from "next/server";
import { hashPassword, invalidateSessions } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    // Validation
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

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find customer with valid token
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('password_reset_token', hashedToken)
      .eq('is_active', true)
      .gt('password_reset_expiry', new Date().toISOString())
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Invalid or expired reset token. Please request a new password reset link." 
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    await supabaseAdmin
      .from('customers')
      .update({
        password_hash: hashedPassword,
        password_reset_token: null,
        password_reset_expiry: null,
      })
      .eq('id', customer.id);

    // No active session to preserve here (this flow isn't authenticated) --
    // if this reset was prompted by a compromised account, every existing
    // session (including whatever an attacker was using) needs to die.
    await invalidateSessions(customer.id);

    return NextResponse.json(
      { 
        success: true, 
        message: "Password reset successful! You can now sign in with your new password." 
      },
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
