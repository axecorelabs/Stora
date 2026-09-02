import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";
import { isValidEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function genericInvalidCredentials() {
  return NextResponse.json(
    { success: false, message: 'Invalid email or password' },
    { status: 401 }
  );
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabaseAdmin
      .from('admin_users')
      .select('id, name, email, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (!user || !user.is_active) {
      return genericInvalidCredentials();
    }

    const result = await auth.api.signInEmail({
      body: { email: normalizedEmail, password },
      headers: req.headers,
      asResponse: true
    });

    if (result.status !== 200) {
      return genericInvalidCredentials();
    }

    const response = NextResponse.json({
      success: true,
      message: 'Signed in successfully',
      user: { id: user.id, name: user.name, email: user.email, isActive: user.is_active }
    });

    const setCookie = result.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);

    return response;
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
