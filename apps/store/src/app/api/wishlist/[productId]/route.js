import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import {
  removeItemFromWishlist,
  updateWishlistItem,
  findWishlistWithItems,
  enrichWishlistWithProductData
} from "@/lib/supabaseWishlist";

// DELETE - Remove item from wishlist
export async function DELETE(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { productId } = await params;

    await removeItemFromWishlist(customerId, productId);

    // Fetch updated wishlist with items
    let wishlist = await findWishlistWithItems(customerId);
    
    // Enrich with fresh product data
    const enrichedWishlist = await enrichWishlistWithProductData(wishlist);

    return NextResponse.json({
      success: true,
      message: "Item removed from wishlist",
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Failed to remove item from wishlist" },
      { status: 500 }
    );
  }
}

// PUT - Update wishlist item
export async function PUT(request, { params }) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { productId } = await params;
    const body = await request.json();
    const { priority, notes, priceDropAlert, backInStockAlert, targetPrice } = body;

    // Build updates object
    const updates = {};
    if (priority !== undefined) updates.priority = priority;
    if (notes !== undefined) updates.notes = notes;
    if (priceDropAlert !== undefined) updates.price_drop_alert = priceDropAlert;
    if (backInStockAlert !== undefined) updates.back_in_stock_alert = backInStockAlert;
    if (targetPrice !== undefined) updates.target_price = targetPrice;

    await updateWishlistItem(customerId, productId, updates);

    // Fetch updated wishlist with items
    let wishlist = await findWishlistWithItems(customerId);
    
    // Enrich with fresh product data
    const enrichedWishlist = await enrichWishlistWithProductData(wishlist);

    return NextResponse.json({
      success: true,
      message: "Wishlist item updated",
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error("Error updating wishlist item:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update wishlist item" },
      { status: 500 }
    );
  }
}
