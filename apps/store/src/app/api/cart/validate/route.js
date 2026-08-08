import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, validateCartStock } from "@/lib/supabaseCart";

export async function POST(request) {
  try {
    // Verify customer session
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const cart = await getOrCreateCart(customerId);

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cart is empty" },
        { status: 400 }
      );
    }

    // Validate stock availability
    const validation = await validateCartStock(cart);

    return NextResponse.json({
      success: true,
      isValid: validation.isValid,
      unavailableItems: validation.unavailableItems
    });
  } catch (error) {
    console.error("Error validating cart:", error);
    return NextResponse.json(
      { success: false, message: "Failed to validate cart" },
      { status: 500 }
    );
  }
}
