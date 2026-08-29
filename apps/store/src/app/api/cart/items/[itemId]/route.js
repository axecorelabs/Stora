import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, updateCartItemQuantityById, removeCartItemById, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";

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

    // The cart line's own id, not product_id -- two lines can share a
    // product_id (a different variant and/or a different priced-extras
    // selection), so this is the only unambiguous way to target one.
    const { itemId } = await params;
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
    cart = await updateCartItemQuantityById(cart, itemId, quantity);

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

    const { itemId } = await params;

    let cart = await getOrCreateCart(customerId);

    cart = await removeCartItemById(cart, itemId);

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
