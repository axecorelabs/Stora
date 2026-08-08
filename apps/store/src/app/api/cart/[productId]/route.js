import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, removeItemFromCart, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";

export async function DELETE(request, { params }) {
  try {
    // Verify customer session
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { productId } = await params;

    // Find customer's cart
    let cart = await getOrCreateCart(customerId);

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cart is empty" },
        { status: 404 }
      );
    }

    // Check if item exists
    const itemExists = cart.items.some(item => item.product_id === productId);

    if (!itemExists) {
      return NextResponse.json(
        { success: false, message: "Item not found in cart" },
        { status: 404 }
      );
    }

    // Remove the item
    cart = await removeItemFromCart(cart, productId);
    
    // Enrich cart
    cart = await enrichCartWithProductData(cart);

    return NextResponse.json({
      success: true,
      message: "Item removed from cart successfully",
      cart: sanitizeCart(cart)
    });

  } catch (error) {
    console.error("Error removing item from cart:", error);
    return NextResponse.json(
      { success: false, message: "Failed to remove item from cart" },
      { status: 500 }
    );
  }
}
