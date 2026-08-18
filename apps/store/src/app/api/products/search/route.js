import { NextResponse } from "next/server";
import { searchProductsPaginated } from "@/lib/supabaseStore";
import { cached, cacheKey } from "@/lib/redis";

const PAGE_SIZE = 24;
// Only the plain "browse" landing view is cached -- no query, no category,
// first page. That's the overwhelming majority of visits to this page
// (someone just clicking into /products), and unlike free-text search
// (too many distinct terms for caching to pay off) it's a single, cheap-
// to-invalidate-by-TTL entry per sort option.
const DEFAULT_BROWSE_TTL_SECONDS = 180;

// Public, unauthenticated -- backs the dedicated /products search & browse
// page. Distinct from /api/products/discover (small, cached homepage
// teaser capped at a fixed candidate pool); this one is built for real
// pagination across the full catalog, see searchProductsPaginated.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || undefined;
    const categories = searchParams.get("category")?.split(",").filter(Boolean) || undefined;
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const sortParam = searchParams.get("sort");
    // "nearest" with no buyer state to sort against is inert at the DB
    // layer (it degrades to the default ordering) -- fall back explicitly
    // here rather than forwarding a sort mode that can't do anything.
    const sort = sortParam === "nearest" && buyerState ? "nearest" : sortParam === "new" ? "new" : "trending";
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const minPriceParam = parseFloat(searchParams.get("minPrice"));
    const maxPriceParam = parseFloat(searchParams.get("maxPrice"));
    const minPrice = Number.isFinite(minPriceParam) ? minPriceParam : undefined;
    const maxPrice = Number.isFinite(maxPriceParam) ? maxPriceParam : undefined;

    const isDefaultBrowse = !search && !categories?.length && !state && sort !== "nearest"
      && page === 1 && minPrice === undefined && maxPrice === undefined;
    const fetchResults = () => searchProductsPaginated({
      search,
      categories,
      state,
      buyerState,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      minPrice,
      maxPrice
    });

    const { products, totalCount } = isDefaultBrowse
      ? await cached(cacheKey.productsSearchDefault(sort), DEFAULT_BROWSE_TTL_SECONDS, fetchResults)
      : await fetchResults();

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
    console.error("Error searching products:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search products" },
      { status: 500 }
    );
  }
}
