import { NextResponse } from "next/server";
import { searchVendorsPaginated } from "@/lib/supabaseStore";
import { BUSINESS_CATEGORY_VALUES, BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY } from "@stora/shared-constants";

const PAGE_SIZE = 24;
const ALL_BUSINESS_SUBCATEGORIES = new Set(
  Object.values(BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY)
    .flatMap((options) => options.map((option) => option.value))
);

function normalizeBusinessSubcategories(rawValues, businessCategory) {
  const values = (rawValues || [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const allowed = businessCategory && BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY[businessCategory]
    ? new Set(BUSINESS_SUBCATEGORY_OPTIONS_BY_CATEGORY[businessCategory].map((option) => option.value))
    : ALL_BUSINESS_SUBCATEGORIES;
  return [...new Set(values)].filter((value) => allowed.has(value));
}

// Public, unauthenticated -- backs the dedicated /vendors search & browse
// page. Distinct from /api/stores/featured (small, cached homepage
// teaser); this one is built for real pagination across the full vendor
// directory, see searchVendorsPaginated.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() || undefined;
    const categories = searchParams.get("category")?.split(",").filter(Boolean) || undefined;
    const state = searchParams.get("state") || undefined;
    const buyerState = searchParams.get("buyerState") || undefined;
    const deliverableOnly = searchParams.get("deliverableOnly") === "true" && !!buyerState;
    const businessCategoryParam = searchParams.get("businessCategory")?.trim().toLowerCase();
    const businessCategory = BUSINESS_CATEGORY_VALUES.includes(businessCategoryParam)
      ? businessCategoryParam
      : undefined;
    const requestedBusinessSubcategory = searchParams.get("businessSubcategory")?.trim().toLowerCase();
    const requestedBusinessSubcategories = searchParams
      .get("businessSubcategories")
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) || [];
    const [businessSubcategory = undefined, ...otherSubcategories] = normalizeBusinessSubcategories(
      [requestedBusinessSubcategory, ...requestedBusinessSubcategories],
      businessCategory
    );
    const businessSubcategories = otherSubcategories.length > 0 ? otherSubcategories : undefined;
    const scopeParam = searchParams.get("scope");
    const scope = scopeParam === "products" || scopeParam === "services" ? scopeParam : undefined;
    const sortParam = searchParams.get("sort");
    const sortRequested = ["featured", "newest", "name", "nearest"].includes(sortParam) ? sortParam : "featured";
    // "nearest" with no buyer state to sort against is inert at the DB
    // layer (it degrades to the default ordering) -- fall back explicitly
    // here rather than forwarding a sort mode that can't do anything.
    const sort = sortRequested === "nearest" && !buyerState ? "featured" : sortRequested;
    const pageParam = parseInt(searchParams.get("page"), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

    const { vendors, totalCount } = await searchVendorsPaginated({
      search,
      categories,
      state,
      buyerState,
      deliverableOnly,
      businessCategory,
      businessSubcategory,
      businessSubcategories,
      scope,
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
