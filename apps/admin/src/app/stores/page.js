"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, Store, CheckCircle2, Globe, LayoutList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import StatStrip from "@/components/StatStrip";
import StoreLogo from "@/components/StoreLogo";
import ToggleSwitch from "@/components/ToggleSwitch";
import Pagination from "@/components/Pagination";
import CustomDropdown from "@/components/ui/CustomDropdown";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" }
];

// Filters by the vendor's own identity check (is_verified), not the
// separate "Verified by Stora" badge -- that one has no filter, just the
// per-store toggle column below.
const VERIFIED_OPTIONS = [
  { value: "", label: "All ID verification" },
  { value: "verified", label: "ID verified" },
  { value: "pending", label: "Pending" }
];

const PLATFORM_MODE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "store", label: "Full stores" },
  { value: "listing", label: "Listings only" }
];

function formatNaira(kobo) {
  if (!Number.isFinite(kobo)) return "-";
  return `₦${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StoresPageContent() {
  const { secureApiCall } = useAuth();
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [platformModeFilter, setPlatformModeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loadingKey, setLoadingKey] = useState(null);

  // Reset to page 1 when filters change, following React's own
  // "adjusting state when a prop changes" pattern (setState during render,
  // guarded by a prev-value comparison) rather than an effect -- avoids a
  // second render pass just to reset a page number.
  const [prevFilters, setPrevFilters] = useState({ query, statusFilter, verifiedFilter, platformModeFilter });
  if (query !== prevFilters.query || statusFilter !== prevFilters.statusFilter || verifiedFilter !== prevFilters.verifiedFilter || platformModeFilter !== prevFilters.platformModeFilter) {
    setPrevFilters({ query, statusFilter, verifiedFilter, platformModeFilter });
    setPage(1);
  }

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      if (params.q) search.set("q", params.q);
      if (params.status) search.set("status", params.status);
      if (params.verified) search.set("verified", params.verified);
      if (params.platformMode) search.set("platform_mode", params.platformMode);
      search.set("offset", String((params.page - 1) * PAGE_SIZE));
      const data = await secureApiCall(`/api/stores?${search.toString()}`);
      if (data.success) {
        setStores(data.stores);
        setTotal(data.total);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error loading stores:", error);
    } finally {
      setLoading(false);
    }
  }, [secureApiCall]);

  useEffect(() => {
    const timeout = setTimeout(() => load({ q: query, status: statusFilter, verified: verifiedFilter, platformMode: platformModeFilter, page }), 300);
    return () => clearTimeout(timeout);
  }, [query, statusFilter, verifiedFilter, platformModeFilter, page, load]);

  const handleToggleStorefront = async (store, nextValue) => {
    setLoadingKey(`storefront-${store.id}`);
    try {
      const data = await secureApiCall(`/api/stores/${store.id}/storefront`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: nextValue })
      });
      if (data.success) {
        setStores((prev) =>
          prev.map((s) =>
            s.id === store.id ? { ...s, isPublished: data.store.isEnabled, isLive: s.isActive && data.store.isEnabled } : s
          )
        );
      }
    } catch (error) {
      console.error("Error updating storefront status:", error);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleToggleAccount = async (store, nextValue) => {
    setLoadingKey(`account-${store.id}`);
    try {
      const data = await secureApiCall(`/api/stores/${store.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextValue })
      });
      if (data.success) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, isActive: data.store.isActive, isLive: data.store.isActive && s.isPublished } : s))
        );
      }
    } catch (error) {
      console.error("Error updating account status:", error);
    } finally {
      setLoadingKey(null);
    }
  };

  // The ONLY place the public "Verified by Stora" badge is ever set -- a
  // vendor contacts Stora directly and staff decide here; there's no
  // self-serve request flow. Distinct from store.isVerified (the vendor's
  // own QoreID identity check, read-only in this table).
  const handleToggleBusinessVerified = async (store, nextValue) => {
    setLoadingKey(`business-verified-${store.id}`);
    try {
      const data = await secureApiCall(`/api/stores/${store.id}`, {
        method: "PATCH",
        body: JSON.stringify({ businessVerified: nextValue })
      });
      if (data.success) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, businessVerified: data.store.businessVerified } : s))
        );
      }
    } catch (error) {
      console.error("Error updating business-verified status:", error);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleToggleLogin = async (store, nextValue) => {
    if (!store.owner) return;
    setLoadingKey(`login-${store.owner.id}`);
    try {
      const data = await secureApiCall(`/api/users/${store.owner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextValue })
      });
      if (data.success) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, owner: { ...s.owner, isActive: data.user.isActive } } : s))
        );
      }
    } catch (error) {
      console.error("Error updating account status:", error);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleActivateManualListingSubscription = async (store) => {
    const rawAmount = window.prompt(`Record physical payment for ${store.storeName}. Enter amount in Naira (e.g. 5000):`, "5000");
    if (rawAmount === null) return;

    const parsedAmount = Number(rawAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      window.alert("Please enter a valid amount greater than zero.");
      return;
    }

    const note = window.prompt("Optional note (bank transfer ref, teller note, POS slip etc):", "") || "";

    setLoadingKey(`subscription-${store.id}`);
    try {
      const data = await secureApiCall(`/api/stores/${store.id}/subscription/manual`, {
        method: "POST",
        body: JSON.stringify({
          amountNaira: parsedAmount,
          currency: "NGN",
          periodDays: 30,
          note: note.trim() || null,
        })
      });

      if (data.success) {
        setStores((prev) =>
          prev.map((s) =>
            s.id === store.id
              ? {
                  ...s,
                  subscriptionStatus: data.store.subscriptionStatus,
                  isPublished: data.store.isPublished,
                  isLive: data.store.isLive,
                }
              : s
          )
        );

        window.alert(`Subscription activated for ${store.storeName}. Recorded payment: ${formatNaira(data.payment.amountKobo)}.`);
      }
    } catch (error) {
      console.error("Error activating manual subscription:", error);
      window.alert(error?.message || "Failed to activate manual subscription.");
    } finally {
      setLoadingKey(null);
    }
  };

  const statRows = stats
    ? [
        { key: "total", icon: Store, tone: "brand", label: "Vendors", value: stats.total, sub: "matching filters" },
        { key: "active", icon: CheckCircle2, tone: "brand", label: "Active accounts", value: stats.active, sub: `${stats.total - stats.active} suspended` },
        { key: "published", icon: Globe, tone: "gold", label: "Published storefronts", value: stats.published, sub: "live to customers" },
        { key: "verified", icon: CheckCircle2, tone: "gold", label: "ID verified", value: stats.verified, sub: `${stats.total - stats.verified} pending` }
      ]
    : [];

  return (
    <div className="space-y-4">
      {stats && <StatStrip rows={statRows} />}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors by name or slug..."
            className="pl-9 pr-3 py-2 w-full sm:w-64 md:w-80 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
          />
        </div>
        <CustomDropdown options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} className="w-full sm:w-44" />
        <CustomDropdown options={VERIFIED_OPTIONS} value={verifiedFilter} onChange={setVerifiedFilter} className="w-full sm:w-44" />
        <CustomDropdown options={PLATFORM_MODE_OPTIONS} value={platformModeFilter} onChange={setPlatformModeFilter} className="w-full sm:w-44" />
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
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Sales</th>
                  <th className="px-4 py-3 font-medium text-right">Orders</th>
                  <th className="px-4 py-3 font-medium text-center">Storefront</th>
                  <th className="px-4 py-3 font-medium text-center">Account</th>
                  <th className="px-4 py-3 font-medium text-center">Login</th>
                  <th className="px-4 py-3 font-medium text-center">Verified by Stora</th>
                  <th className="px-4 py-3 font-medium text-center">Listing subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stores.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-sm text-gray-400 text-center">No vendors found.</td>
                  </tr>
                )}
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StoreLogo logoUrl={store.logoUrl} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{store.storeName}</p>
                          <p className="text-xs text-gray-400 truncate">{store.storeSlug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{store.owner?.name || "—"}</p>
                      <p className="text-xs text-gray-400">{store.owner?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${store.isLive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {store.isLive ? "Live" : store.isActive ? "Not published" : "Suspended"}
                        </span>
                        {/* This is the vendor's OWN identity check (QoreID
                            NIN + live selfie) -- distinct from the public
                            "Verified by Stora" badge, which is a separate,
                            staff-granted toggle in its own column below. */}
                        {store.isVerified && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">ID verified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ₦{store.totalSales.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {store.totalOrders}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={store.isPublished}
                          loading={loadingKey === `storefront-${store.id}`}
                          onChange={(next) => handleToggleStorefront(store, next)}
                          label="Publish/unpublish storefront"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={store.isActive}
                          loading={loadingKey === `account-${store.id}`}
                          onChange={(next) => handleToggleAccount(store, next)}
                          label="Suspend/reinstate account"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={store.owner?.isActive}
                          loading={loadingKey === `login-${store.owner?.id}`}
                          onChange={(next) => handleToggleLogin(store, next)}
                          label="Enable/disable owner login"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ToggleSwitch
                          checked={store.businessVerified}
                          loading={loadingKey === `business-verified-${store.id}`}
                          onChange={(next) => handleToggleBusinessVerified(store, next)}
                          label="Grant/revoke the public Verified by Stora badge"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(store.platformMode || 'store') === 'listing' ? (
                        <div className="flex flex-col items-center gap-2">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${store.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : store.subscriptionStatus === 'past_due' ? 'bg-amber-50 text-amber-700' : store.subscriptionStatus === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {store.subscriptionStatus || 'none'}
                          </span>
                          {store.subscriptionStatus !== 'active' && (
                            <button
                              type="button"
                              onClick={() => handleActivateManualListingSubscription(store)}
                              disabled={loadingKey === `subscription-${store.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
                            >
                              {loadingKey === `subscription-${store.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Activate (manual)
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-400">—</div>
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

export default function StoresPage() {
  return (
    <AdminLayout title="Vendors" subtitle="Every store on Stora — status, totals, and account control.">
      <StoresPageContent />
    </AdminLayout>
  );
}
