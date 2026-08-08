import { NextResponse } from "next/server";
import { verifyCustomerSession } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getOrCreateWishlist,
  findWishlistWithItems,
  addItemToWishlist,
  prepareWishlistItemData,
  enrichWishlistWithProductData
} from "@/lib/supabaseWishlist";

// GET - Fetch customer's wishlist
export async function GET(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    let wishlist = await findWishlistWithItems(customerId);
    
    if (!wishlist) {
      // Create wishlist if it doesn't exist
      const newWishlist = await getOrCreateWishlist(customerId);
      wishlist = { ...newWishlist, items: [] };
    }
    
    // Enrich with fresh product data
    wishlist = await enrichWishlistWithProductData(wishlist);

    return NextResponse.json({
      success: true,
      wishlist
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
}

// POST - Add item to wishlist
export async function POST(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, priority = 'medium', notes = '', notifications = {} } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "Product ID is required" },
        { status: 400 }
      );
    }

    // Prepare item data with product and store snapshots
    const itemData = await prepareWishlistItemData(productId, {
      priority,
      notes,
      notifications
    });

    // Add to wishlist
    const wishlist = await addItemToWishlist(customerId, itemData);

    // Enrich with fresh product data
    const enrichedWishlist = await enrichWishlistWithProductData(wishlist);

    return NextResponse.json({
      success: true,
      message: "Item added to wishlist",
      wishlist: enrichedWishlist
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    
    if (error.message === 'Product already in wishlist') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to add item to wishlist" },
      { status: 500 }
    );
  }
}

// PUT - Update wishlist settings
export async function PUT(request) {
  try {
    const customerId = await verifyCustomerSession(request);
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, isPublic } = body;

    const wishlist = await getOrCreateWishlist(customerId);

    // Update wishlist properties using Supabase
    const { data, error } = await supabaseAdmin
      .from('wishlists')
      .update({
        name: name !== undefined ? name : wishlist.name,
        description: description !== undefined ? description : wishlist.description,
        is_public: isPublic !== undefined ? isPublic : wishlist.is_public,
        updated_at: new Date().toISOString()
      })
      .eq('id', wishlist.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Wishlist updated successfully",
      wishlist: data
    });
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update wishlist" },
      { status: 500 }
    );
  }
}
