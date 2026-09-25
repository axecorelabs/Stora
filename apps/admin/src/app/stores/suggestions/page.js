"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import Pagination from "@/components/Pagination";
import CustomDropdown from "@/components/ui/CustomDropdown";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" }
];

function SuggestionsPageContent() {
  const { secureApiCall } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("new");
  const [page, setPage] = useState(1);
  const [loadingKey, setLoadingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      if (statusFilter) search.set("status", statusFilter);
      search.set("offset", String((page - 1) * PAGE_SIZE));
      const data = await secureApiCall(`/api/business-suggestions?${search.toString()}`);
      if (data.success) {
        setSuggestions(data.suggestions);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error loading business suggestions:", error);
    } finally {
      setLoading(false);
    }
  }, [secureApiCall, statusFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleAction = async (suggestion, status) => {
    setLoadingKey(`${status}-${suggestion.id}`);
    try {
      const data = await secureApiCall(`/api/business-suggestions/${suggestion.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (data.success) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error updating business suggestion:", error);
    } finally {
      setLoadingKey(null);
    }
  };

  const createListingHref = (suggestion) => {
    const params = new URLSearchParams({ prefillName: suggestion.suggestedName, suggestionId: suggestion.id });
    if (suggestion.suggestedLocationText) params.set("prefillLocation", suggestion.suggestedLocationText);
    return `/stores?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/stores" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Back to vendors
        </Link>
        <CustomDropdown options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="w-44" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
        </div>
      ) : (
        <>
          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">What/Where</th>
                  <th className="px-4 py-3 font-medium">Submitter</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suggestions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-sm text-gray-400 text-center">No suggestions found.</td>
                  </tr>
                )}
                {suggestions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.suggestedName}</p>
                      <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>{s.suggestedCategoryText || "—"}</p>
                      <p className="text-xs text-gray-400">{s.suggestedLocationText || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.submitterContact || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={s.notes || ""}>{s.notes || "—"}</td>
                    <td className="px-4 py-3">
                      {statusFilter !== "new" ? (
                        <div className="flex justify-end">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{s.status}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={createListingHref(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-50"
                          >
                            <Store className="w-3.5 h-3.5" />
                            Create listing
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleAction(s, "dismissed")}
                            disabled={loadingKey === `dismissed-${s.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {loadingKey === `dismissed-${s.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        </>
      )}
    </div>
  );
}

export default function SuggestionsPage() {
  return (
    <AdminLayout title="Business Suggestions" subtitle="Public tips on businesses that should be on Stora.">
      <SuggestionsPageContent />
    </AdminLayout>
  );
}
