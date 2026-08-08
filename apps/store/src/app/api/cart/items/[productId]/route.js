import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, updateItemQuantity, removeItemFromCart, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";

// PATCH - Update item quantity
export async function PATCH(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { productId } = await params;
    const body = await request.json();
    const { quantity } = body;

    if (quantity === undefined || quantity < 0) {
      return NextResponse.json(
        { success: false, message: "Invalid quantity" },
        { status: 400 }
      );
    }

    let cart = await getOrCreateCart(customerId);

    // Update quantity (removes item if quantity is 0)
    cart = await updateItemQuantity(cart, productId, quantity);
    
    // Enrich cart
    cart = await enrichCartWithProductData(cart);

    return NextResponse.json({
      success: true,
      message: "Cart updated successfully",
      cart: sanitizeCart(cart)
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update cart item" },
      { status: 500 }
    );
  }
}

// DELETE - Remove item from cart
export async function DELETE(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { productId } = await params;

    let cart = await getOrCreateCart(customerId);

    cart = await removeItemFromCart(cart, productId);
    
    // Enrich cart
    cart = await enrichCartWithProductData(cart);

    return NextResponse.json({
      success: true,
      message: "Item removed from cart",
      cart: sanitizeCart(cart)
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    return NextResponse.json(
      { success: false, message: "Failed to remove item" },
      { status: 500 }
    );
  }
}
