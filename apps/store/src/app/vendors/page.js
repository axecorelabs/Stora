"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, Loader2 } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import SearchModeTabs from "@/components/search/SearchModeTabs";
import SearchConsole from "@/components/search/SearchConsole";
import ActiveFilters from "@/components/search/ActiveFilters";
import VendorSearchCard from "@/components/search/VendorSearchCard";

const SORTS = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "name", label: "Name (A-Z)" },
];

function VendorsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") || "";
  const urlSort = SORTS.some((s) => s.key === searchParams.get("sort")) ? searchParams.get("sort") : "featured";
  const urlCategory = searchParams.get("category") || "";

  const [q, setQ] = useState(urlQ);
  const [sort, setSort] = useState(urlSort);
  const [category, setCategory] = useState(urlCategory);
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "featured") params.set("sort", sort);
    if (category) params.set("category", category);
    const qs = params.toString();
    router.replace(qs ? `/vendors?${qs}` : "/vendors", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, category]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, page: String(pageNum) });
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      const res = await fetch(`/api/vendors/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setVendors((prev) => (replace ? data.vendors : [...prev, ...data.vendors]));
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error searching vendors:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, sort, category]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  const activeFilters = [
    category && { key: "category", label: `Sells ${category}`, onRemove: () => setCategory("") }
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SearchModeTabs query={q} />

        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-1">
            {q ? `Vendors matching "${q}"` : "All vendors"}
          </h1>
        </div>

        <SearchConsole
          query={q}
          onQueryChange={setQ}
          searchPlaceholder="Search vendors by name…"
          category={category}
          onCategoryChange={setCategory}
          resultCount={pagination?.total}
          loading={loading}
          resultLabel="vendors"
        />

        {activeFilters.length > 0 && (
          <div className="flex justify-center mb-6">
            <ActiveFilters filters={activeFilters} onClearAll={() => setCategory("")} />
          </div>
        )}

        {/* Sort -- top-right corner of the grid it controls. */}
        <div className="flex items-center justify-end gap-1 mb-6">
          {SORTS.map(({ key, label }) => (
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

        <div id="search-results">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[320px] rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm mb-4">
              {q
                ? `No vendors match "${q}".`
                : category
                  ? `No vendors currently sell ${category}.`
                  : "New vendors are joining Stora every week -- check back soon."}
            </p>
            {activeFilters.length > 0 && (
              <button
                onClick={() => setCategory("")}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {vendors.map((store) => (
                <VendorSearchCard key={store.id} store={store} />
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
                  {loadingMore ? "Loading…" : `Load more (${vendors.length} of ${pagination.total.toLocaleString()})`}
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={null}>
      <VendorsPageInner />
    </Suspense>
  );
}
