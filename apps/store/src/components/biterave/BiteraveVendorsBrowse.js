"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, Loader2, Search, Sparkles, UtensilsCrossed, ShoppingBasket } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import AISearchInput from "@/components/search/AISearchInput";
import RestaurantCard from "./RestaurantCard";
import FoodItemCard from "./FoodItemCard";
import BiteraveAuthGateProvider from "./BiteraveAuthGateProvider";
import BiteraveLocationBar from "./BiteraveLocationBar";
import { useBiteraveLocationScope } from "./useBiteraveLocationScope";

// Real, indexed pagination for one Biterave vendor type (restaurants or
// grocery vendors) -- shared by apps/store/src/app/biterave/restaurants
// and .../groceries/vendors, mirroring /vendors/page.js's mechanics
// (URL-synced query, "Load more" append, AI mode hitting the same
// /api/search/ai route with primary=vendors) via /api/biterave/vendors/search.
// AI mode was missing here entirely until now -- an inconsistency with
// /vendors/page.js (which has it) and with BiteraveProductsBrowse.js
// (which already got it), not a deliberate cut.
function BiteraveVendorsBrowseInner({ type }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = type === "meals" ? "/biterave/restaurants" : "/biterave/groceries/vendors";
  const isMeals = type === "meals";

  const urlQ = searchParams.get("q") || "";
  const urlAiMode = searchParams.get("mode") === "ai";
  const [q, setQ] = useState(urlQ);
  const [aiMode, setAiMode] = useState(urlAiMode);
  const [vendors, setVendors] = useState([]);
  // AI mode's supplementary strip -- the products /api/search/ai returns
  // alongside vendors (see the route's SECONDARY_LIMIT), same "Dishes/
  // Groceries worth trying" treatment /vendors/page.js already has.
  const [aiProducts, setAiProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scope = useBiteraveLocationScope();
  const { buyerState, deliverableOnly } = scope;

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (aiMode) params.set("mode", "ai");
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, aiMode]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (aiMode && !q) {
      setVendors([]);
      setAiProducts([]);
      setPagination(null);
      setLoading(false);
      return;
    }

    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      if (aiMode) {
        const params = new URLSearchParams({ q, source: "biterave", type, primary: "vendors", page: String(pageNum) });
        if (buyerState) params.set("buyerState", buyerState);
        if (deliverableOnly) params.set("deliverableOnly", "true");
        const res = await fetch(`/api/search/ai?${params}`);
        const data = await res.json();
        if (data.success) {
          setVendors((prev) => (replace ? data.vendors : [...prev, ...data.vendors]));
          setAiProducts(data.products || []);
          setPagination(data.pagination);
        }
        return;
      }

      const params = new URLSearchParams({ type, page: String(pageNum) });
      if (q) params.set("q", q);
      if (buyerState) params.set("buyerState", buyerState);
      if (deliverableOnly) params.set("deliverableOnly", "true");
      const res = await fetch(`/api/biterave/vendors/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setVendors((prev) => (replace ? data.vendors : [...prev, ...data.vendors]));
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error searching Biterave vendors:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, aiMode, type, buyerState, deliverableOnly]);

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
          {isMeals ? "All restaurants" : "All grocery vendors"}
        </h1>

        <BiteraveLocationBar scope={scope} />

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
            className="rounded-2xl p-[1.5px] mb-6 max-w-xl"
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
                    ? "Describe the kind of restaurant you're after..."
                    : "Describe the kind of grocery vendor you're after..."
                }
              />
            </div>
          </div>
        ) : (
          <div className="relative mb-6 max-w-xl">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isMeals ? "Search restaurants..." : "Search grocery vendors..."}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
            />
          </div>
        )}

        {aiMode && !q ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              Describe what you&apos;re looking for above to get AI-matched {isMeals ? "restaurants" : "grocery vendors"}.
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 h-24 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              {q
                ? `No ${isMeals ? "restaurants" : "grocery vendors"} match "${q}"${deliverableOnly ? ` near ${scope.deliveryState}` : ""}.`
                : deliverableOnly
                  ? `No ${isMeals ? "restaurants" : "grocery vendors"} deliver to ${scope.deliveryState} yet.`
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
            {aiMode && aiProducts.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  {isMeals ? "Dishes worth trying" : "Groceries worth trying"}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {aiProducts.map((product) => (
                    <div key={product.id} className="w-40 flex-shrink-0">
                      <FoodItemCard product={product} storeSlug={product.store?.storeSlug} storeName={product.store?.storeName} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((store) => (
                <RestaurantCard key={store.id} store={store} />
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
                  {loadingMore ? "Loading..." : `Load more (${vendors.length} of ${pagination.total.toLocaleString()})`}
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

export default function BiteraveVendorsBrowse({ type }) {
  return (
    <Suspense fallback={null}>
      <BiteraveVendorsBrowseInner type={type} />
    </Suspense>
  );
}
