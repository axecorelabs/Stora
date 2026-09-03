import { NextResponse } from "next/server";
import { searchBiteraveVendors } from "@/lib/supabaseStore";

const PAGE_SIZE = 24;

// Public, unauthenticated -- backs /biterave/restaurants and
// /biterave/groceries/vendors. Mirrors /api/vendors/search/route.js
// exactly, `type` maps to search_biterave_vendors' p_meal_only (a real
// EXISTS-against-inventory check, same technique the plain search_vendors
// function already uses for its own category filter).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") === "groceries" ? "groceries" : "meals";
    const mealOnly = type === "meals";
    const search = searchParams.get("q")?.trim() || undefined;
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const deliverableOnly = searchParams.get("deliverableOnly") === "true" && !!buyerState;
    const sortParam = searchParams.get("sort");
    const sortRequested = ["featured", "newest", "name", "nearest"].includes(sortParam) ? sortParam : "featured";
    const sort = sortRequested === "nearest" && !buyerState ? "featured" : sortRequested;
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { vendors, totalCount } = await searchBiteraveVendors({
      mealOnly,
      search,
      state,
      buyerState,
      deliverableOnly,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    });

    return NextResponse.json({
      success: true,
      vendors,
      pagination: {
        page,
        limit: PAGE_SIZE,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        hasMore: page * PAGE_SIZE < totalCount
      }
    });
  } catch (error) {
    console.error("Error searching Biterave vendors:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search vendors" },
      { status: 500 }
    );
  }
}
