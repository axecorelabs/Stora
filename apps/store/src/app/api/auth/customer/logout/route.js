import { NextResponse } from "next/server";
import { auth } from "@/lib/betterAuth";

export async function POST(request) {
  try {
    const response = await auth.api.signOut({
      headers: request.headers,
      asResponse: true
    });

    const result = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) result.headers.set("set-cookie", setCookie);

    return result;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, message: "Logout failed" },
      { status: 500 }
    );
  }
}
