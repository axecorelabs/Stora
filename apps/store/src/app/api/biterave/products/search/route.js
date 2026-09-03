import { NextResponse } from "next/server";
import { searchBiteraveProducts } from "@/lib/supabaseStore";

const PAGE_SIZE = 24;

// Public, unauthenticated -- backs /biterave/meals and /biterave/groceries.
// Mirrors /api/products/search/route.js exactly, except `type` is
// required and maps to a real, indexed SQL-level filter (search_biterave_
// products' p_meal_only) rather than a caller-supplied category -- see
// 20260905000000_biterave_search.sql for why that has to be a real column,
// not a JS-side filter, for pagination to stay correct.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") === "groceries" ? "groceries" : "meals";
    const mealOnly = type === "meals";
    const search = searchParams.get("q")?.trim() || undefined;
    const cuisine = searchParams.get("cuisine")?.trim() || undefined;
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const deliverableOnly = searchParams.get("deliverableOnly") === "true" && !!buyerState;
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "nearest" && buyerState ? "nearest" : sortParam === "new" ? "new" : "trending";
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const minPriceParam = parseFloat(searchParams.get("minPrice"));
    const maxPriceParam = parseFloat(searchParams.get("maxPrice"));
    const minPrice = Number.isFinite(minPriceParam) ? minPriceParam : undefined;
    const maxPrice = Number.isFinite(maxPriceParam) ? maxPriceParam : undefined;

    const { products, totalCount } = await searchBiteraveProducts({
      mealOnly,
      search,
      cuisine,
      state,
      buyerState,
      deliverableOnly,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      minPrice,
      maxPrice
    });

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        page,
        limit: PAGE_SIZE,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        hasMore: page * PAGE_SIZE < totalCount
      }
    });
  } catch (error) {
    console.error("Error searching Biterave products:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search products" },
      { status: 500 }
    );
  }
}
