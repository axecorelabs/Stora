"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import Pagination from "@/components/Pagination";
import CustomDropdown from "@/components/ui/CustomDropdown";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "upheld", label: "Upheld" },
  { value: "dismissed", label: "Dismissed" }
];

function DisputesPageContent() {
  const { secureApiCall } = useAuth();
  const [disputes, setDisputes] = useState([]);
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
      const data = await secureApiCall(`/api/business-claim-disputes?${search.toString()}`);
      if (data.success) {
        setDisputes(data.disputes);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error loading business claim disputes:", error);
    } finally {
      setLoading(false);
    }
  }, [secureApiCall, statusFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleAction = async (dispute, status) => {
    if (status === 'upheld' && !window.confirm(`Revoke ${dispute.storeName || 'this store'}'s claim? This resets it back to unclaimed.`)) {
      return;
    }
    setLoadingKey(`${status}-${dispute.id}`);
    try {
      const data = await secureApiCall(`/api/business-claim-disputes/${dispute.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (data.success) {
        setDisputes((prev) => prev.filter((d) => d.id !== dispute.id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error updating business claim dispute:", error);
    } finally {
      setLoadingKey(null);
    }
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
                  <th className="px-4 py-3 font-medium">Reporter</th>
                  <th className="px-4 py-3 font-medium">Relationship</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disputes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-sm text-gray-400 text-center">No reports found.</td>
                  </tr>
                )}
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.storeName || "—"}</p>
                      <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>{d.reporterName}</p>
                      <p className="text-xs text-gray-400">{d.reporterEmail}{d.reporterPhone ? ` · ${d.reporterPhone}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{d.relationship}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={d.details}>{d.details}</td>
                    <td className="px-4 py-3">
                      {!['new', 'reviewing'].includes(statusFilter) ? (
                        <div className="flex justify-end">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{d.status}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {d.status === 'new' && (
                            <button
                              type="button"
                              onClick={() => handleAction(d, "reviewing")}
                              disabled={loadingKey === `reviewing-${d.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                            >
                              {loadingKey === `reviewing-${d.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Mark reviewing
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAction(d, "upheld")}
                            disabled={loadingKey === `upheld-${d.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            {loadingKey === `upheld-${d.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                            Uphold (revoke claim)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(d, "dismissed")}
                            disabled={loadingKey === `dismissed-${d.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {loadingKey === `dismissed-${d.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
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

export default function DisputesPage() {
  return (
    <AdminLayout title="Listing Reports" subtitle="Disputes filed against claimed businesses -- upholding one revokes the claim.">
      <DisputesPageContent />
    </AdminLayout>
  );
}
