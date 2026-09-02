import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, removeCartItemById, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";
import { resolveCampaignAttribution } from "@/lib/campaignAttribution";

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

    // The cart line's own id, not product_id -- two lines can share a
    // product_id (a different variant and/or a different priced-extras
    // selection), so this is the only unambiguous way to target one.
    const { itemId } = await params;

    // Find customer's cart
    let cart = await getOrCreateCart(customerId);

    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Cart is empty" },
        { status: 404 }
      );
    }

    // Check if item exists
    const itemExists = cart.items.some(item => item.id === itemId);

    if (!itemExists) {
      return NextResponse.json(
        { success: false, message: "Item not found in cart" },
        { status: 404 }
      );
    }

    // Remove the item
    cart = await removeCartItemById(cart, itemId);

    // Enrich cart
    const attributionByStoreId = await resolveCampaignAttribution(request);
    cart = await enrichCartWithProductData(cart, attributionByStoreId);

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
