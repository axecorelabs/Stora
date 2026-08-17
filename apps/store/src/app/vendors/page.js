"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, Loader2 } from "lucide-react";
import SiteHeader from "@/components/home/SiteHeader";
import SiteFooter from "@/components/home/SiteFooter";
import SearchModeTabs from "@/components/search/SearchModeTabs";
import SearchBar from "@/components/search/SearchBar";
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

  const [q, setQ] = useState(urlQ);
  const [sort, setSort] = useState(urlSort);
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "featured") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `/vendors?${qs}` : "/vendors", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]);

  const fetchPage = useCallback(async (pageNum, replace) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, page: String(pageNum) });
      if (q) params.set("q", q);
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
  }, [q, sort]);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!pagination || loadingMore) return;
    fetchPage(pagination.page + 1, false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SearchModeTabs query={q} />

        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-900 mb-1">
            {q ? `Vendors matching "${q}"` : "All vendors"}
          </h1>
          <p className="text-sm text-gray-500">
            {loading ? "Searching…" : `${pagination?.total?.toLocaleString() ?? 0} vendor${pagination?.total === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="mb-6">
          <SearchBar value={q} onChange={setQ} placeholder="Search vendors by name…" />
        </div>

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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[320px] rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">
              {q ? `No vendors match "${q}".` : "New vendors are joining Stora every week -- check back soon."}
            </p>
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
