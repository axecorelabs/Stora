"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, Loader2, Search, UtensilsCrossed, ShoppingBasket } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import RestaurantCard from "./RestaurantCard";

// Real, indexed pagination for one Biterave vendor type (restaurants or
// grocery vendors) -- shared by apps/store/src/app/biterave/restaurants
// and .../groceries/vendors, mirroring /vendors/page.js's mechanics
// (URL-synced query, "Load more" append) via /api/biterave/vendors/search.
function BiteraveVendorsBrowseInner({ type }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = type === "meals" ? "/biterave/restaurants" : "/biterave/groceries/vendors";
  const isMeals = type === "meals";

  const urlQ = searchParams.get("q") || "";
  const [q, setQ] = useState(urlQ);
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ type, page: String(pageNum) });
      if (q) params.set("q", q);
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
  }, [q, type]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader brand="biterave" />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold-600 mb-2">
          {isMeals ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <ShoppingBasket className="w-3.5 h-3.5" />}
          Biterave
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-6">
          {isMeals ? "All restaurants" : "All grocery vendors"}
        </h1>

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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 h-24 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              {q ? `No ${isMeals ? "restaurants" : "grocery vendors"} match "${q}".` : "Nothing here yet -- check back soon."}
            </p>
          </div>
        ) : (
          <>
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
  );
}

export default function BiteraveVendorsBrowse({ type }) {
  return (
    <Suspense fallback={null}>
      <BiteraveVendorsBrowseInner type={type} />
    </Suspense>
  );
}
