import { NextResponse } from "next/server";
import { searchVendorsPaginated } from "@/lib/supabaseStore";

const PAGE_SIZE = 24;

// Public, unauthenticated -- backs the dedicated /vendors search & browse
// page. Distinct from /api/stores/featured (small, cached homepage
// teaser); this one is built for real pagination across the full vendor
// directory, see searchVendorsPaginated.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || undefined;
    const category = searchParams.get("category") || undefined;
    const sortParam = searchParams.get("sort");
    const sort = ["featured", "newest", "name"].includes(sortParam) ? sortParam : "featured";
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { vendors, totalCount } = await searchVendorsPaginated({
      search,
      category,
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
    console.error("Error searching vendors:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search vendors" },
      { status: 500 }
    );
  }
}
