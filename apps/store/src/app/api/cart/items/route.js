import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { getOrCreateCart, addItemToCart, prepareCartItemData, enrichCartWithProductData, sanitizeCart } from "@/lib/supabaseCart";

// POST - Add item to cart
export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);

    if (!customerId) {
      console.log('Add to cart: No valid customer session');
      return NextResponse.json(
        { success: false, message: "Please sign in to add items to cart" },
        { status: 401 }
      );
    }

    console.log('Add to cart: Customer ID:', customerId);

    const body = await request.json();
    const { productId, quantity, notes } = body;

    // Validate input
    if (!productId || !quantity || quantity < 1) {
      return NextResponse.json(
        { success: false, message: "Invalid product or quantity" },
        { status: 400 }
      );
    }

    // Get or create cart
    let cart = await getOrCreateCart(customerId);

    // Prepare item data with batch pricing
    const itemData = await prepareCartItemData(productId, quantity, null, notes);

    // Add item to cart
    cart = await addItemToCart(cart, itemData);
    
    // Enrich cart with product data
    cart = await enrichCartWithProductData(cart);

    return NextResponse.json({
      success: true,
      cart: sanitizeCart(cart),
      message: "Item added to cart successfully",
      priceInfo: {
        usedBatchPrice: !!itemData.batch,
        currentPrice: itemData.price,
        availableQuantity: itemData.product_snapshot?.available_stock
      }
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add item to cart" },
      { status: 500 }
    );
  }
}
