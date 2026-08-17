import { NextResponse } from "next/server";
import { searchProductsPaginated } from "@/lib/supabaseStore";

const PAGE_SIZE = 24;

// Public, unauthenticated -- backs the dedicated /products search & browse
// page. Distinct from /api/products/discover (small, cached homepage
// teaser capped at a fixed candidate pool); this one is built for real
// pagination across the full catalog, see searchProductsPaginated.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || undefined;
    const category = searchParams.get("category") || undefined;
    const sortParam = searchParams.get("sort");
    const sort = sortParam === "new" ? "new" : "trending";
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { products, totalCount } = await searchProductsPaginated({
      search,
      category,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
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
    console.error("Error searching products:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search products" },
      { status: 500 }
    );
  }
}
