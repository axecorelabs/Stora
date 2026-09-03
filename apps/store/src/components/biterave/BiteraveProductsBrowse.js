"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Loader2, Sparkles, Search, UtensilsCrossed, ShoppingBasket } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import AISearchInput from "@/components/search/AISearchInput";
import FoodItemCard from "./FoodItemCard";
import RestaurantCard from "./RestaurantCard";
import BiteraveAuthGateProvider from "./BiteraveAuthGateProvider";
import BiteraveLocationBar from "./BiteraveLocationBar";
import { useBiteraveLocationScope } from "./useBiteraveLocationScope";

// Same fixed taxonomy FoodDetailsSection.js's own cuisineType multi-select
// uses in apps/dashboard -- duplicated here rather than shared, matching
// this codebase's established norm of cross-app UI constant duplication
// (apps/admin/apps/dashboard/apps/store can't import from one another).
const CUISINE_OPTIONS = ["Nigerian", "Continental", "Chinese", "Indian", "Fast Food", "Other"];

// Real, indexed pagination + AI search for one Biterave product type
// (meals or groceries) -- shared by both apps/store/src/app/biterave/meals
// and .../groceries, which differ only in `type` and copy. Mirrors
// apps/store/src/app/products/page.js's exact mechanics (URL-synced
// filters, "Load more" append, AI mode toggle hitting the same
// /api/search/ai route with source=biterave) at a scope right-sized for
// Biterave's actual filter set (no category picker -- type IS the
// category; a cuisine chip row instead).
function BiteraveProductsBrowseInner({ type }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = `/biterave/${type}`;
  const isMeals = type === "meals";

  const urlQ = searchParams.get("q") || "";
  const urlCuisine = searchParams.get("cuisine") || "";
  const urlSort = searchParams.get("sort") === "new" ? "new" : "trending";
  const urlAiMode = searchParams.get("mode") === "ai";

  const [q, setQ] = useState(urlQ);
  const [cuisine, setCuisine] = useState(urlCuisine);
  const [sort, setSort] = useState(urlSort);
  const [aiMode, setAiMode] = useState(urlAiMode);
  const [products, setProducts] = useState([]);
  // AI mode's supplementary strip -- the vendors /api/search/ai returns
  // alongside products (see the route's SECONDARY_LIMIT), same "Vendors
  // worth checking out" treatment /products/page.js already has.
  const [aiVendors, setAiVendors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scope = useBiteraveLocationScope();
  const { buyerState, deliverableOnly } = scope;

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (isMeals && cuisine) params.set("cuisine", cuisine);
    if (sort !== "trending") params.set("sort", sort);
    if (aiMode) params.set("mode", "ai");
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cuisine, sort, aiMode]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (aiMode && !q) {
      setProducts([]);
      setAiVendors([]);
      setPagination(null);
      setLoading(false);
      return;
    }

    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      if (aiMode) {
        const params = new URLSearchParams({ q, source: "biterave", type, primary: "products", page: String(pageNum) });
        if (buyerState) params.set("buyerState", buyerState);
        if (deliverableOnly) params.set("deliverableOnly", "true");
        const res = await fetch(`/api/search/ai?${params}`);
        const data = await res.json();
        if (data.success) {
          setProducts((prev) => (replace ? data.products : [...prev, ...data.products]));
          setAiVendors(data.vendors || []);
          setPagination(data.pagination);
        }
        return;
      }

      const params = new URLSearchParams({ type, sort, page: String(pageNum) });
      if (q) params.set("q", q);
      if (isMeals && cuisine) params.set("cuisine", cuisine);
      if (buyerState) params.set("buyerState", buyerState);
      if (deliverableOnly) params.set("deliverableOnly", "true");
      const res = await fetch(`/api/biterave/products/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts((prev) => (replace ? data.products : [...prev, ...data.products]));
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error searching Biterave products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cuisine, sort, aiMode, type, buyerState, deliverableOnly]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  return (
    <BiteraveAuthGateProvider>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader brand="biterave" />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-2">
          {isMeals ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <ShoppingBasket className="w-3.5 h-3.5" />}
          Biterave
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-4">
          {q ? `Results for "${q}"` : isMeals ? "All meals" : "All groceries"}
        </h1>

        <BiteraveLocationBar scope={scope} />

        {/* Small settings-style toggle above the bar, right-aligned -- same
            placement/sizing as components/search/SearchConsole.js's own "AI
            Search" toggle, not a same-weight button sitting beside the
            input. */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setAiMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              aiMode ? "bg-brand-700 text-white border-brand-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask Biterave AI
          </button>
        </div>

        {aiMode ? (
          <div
            className="rounded-2xl p-[1.5px] mb-4"
            style={{
              background: "linear-gradient(115deg, #D8BC85 0%, rgba(216,188,133,0) 35%, rgba(20,92,65,0) 65%, #145C41 100%)"
            }}
          >
            <div className="flex items-start bg-white px-6 py-3.5 rounded-2xl shadow-[0_1px_2px_rgba(11,59,46,0.04),0_20px_48px_-16px_rgba(11,59,46,0.2)]">
              <AISearchInput
                value={q}
                onChange={setQ}
                placeholder={
                  isMeals
                    ? "Describe what you're craving — something spicy, a quick lunch, jollof rice…"
                    : "Describe what you need — ingredients for jollof rice, snacks for a trip…"
                }
              />
            </div>
          </div>
        ) : (
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isMeals ? "Search dishes..." : "Search groceries..."}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
            />
          </div>
        )}

        {isMeals && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            <button
              onClick={() => setCuisine("")}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                !cuisine ? "bg-brand-700 text-white border-brand-700" : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
              }`}
            >
              All cuisines
            </button>
            {CUISINE_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCuisine(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  cuisine === c ? "bg-brand-700 text-white border-brand-700" : "bg-white text-brand-800 border-brand-100 hover:border-brand-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {!aiMode && (
          <div className="flex items-center justify-end gap-1 mb-6">
            {[{ key: "trending", label: "Trending" }, { key: "new", label: "New arrivals" }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sort === key ? "bg-brand-50 text-brand-800" : "text-gray-500 hover:text-brand-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {aiMode && !q ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              Describe what you&apos;re craving above to get AI-matched {isMeals ? "dishes" : "groceries"}.
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              {q
                ? `No ${isMeals ? "dishes" : "groceries"} match "${q}"${deliverableOnly ? ` near ${scope.deliveryState}` : ""}.`
                : deliverableOnly
                  ? `No ${isMeals ? "dishes" : "groceries"} from vendors near ${scope.deliveryState} yet.`
                  : "Nothing here yet -- check back soon."}
            </p>
            {deliverableOnly && (
              <button
                type="button"
                onClick={() => scope.setSeeAll(true)}
                className="mt-3 text-sm font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2"
              >
                See all locations
              </button>
            )}
          </div>
        ) : (
          <>
            {aiMode && aiVendors.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  {isMeals ? "Restaurants worth checking out" : "Vendors worth checking out"}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {aiVendors.map((vendor) => (
                    <div key={vendor.id} className="w-48 flex-shrink-0">
                      <RestaurantCard store={vendor} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => (
                <FoodItemCard
                  key={product.id}
                  product={product}
                  storeSlug={product.store?.storeSlug}
                  storeName={product.store?.storeName}
                />
              ))}
            </div>

            {pagination?.hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-brand-100 text-sm font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50/50 transition-colors disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? "Loading..." : `Load more (${products.length} of ${pagination.total.toLocaleString()})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <SiteFooter brand="biterave" />
    </div>
    </BiteraveAuthGateProvider>
  );
}

export default function BiteraveProductsBrowse({ type }) {
  return (
    <Suspense fallback={null}>
      <BiteraveProductsBrowseInner type={type} />
    </Suspense>
  );
}
