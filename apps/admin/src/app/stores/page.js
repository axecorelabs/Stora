"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Search, Store, CheckCircle2, Globe, LayoutList, Plus, Lightbulb, ShieldAlert } from "lucide-react";
import { BUSINESS_CATEGORY_VALUES, NIGERIAN_STATES } from "@stora/shared-constants";
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

// A third, distinct dimension from is_verified/businessVerified above --
// this is about OWNERSHIP (has a real vendor claimed this row at all),
// not trust. See stores.claim_status.
const CLAIM_STATUS_OPTIONS = [
  { value: "", label: "All listings" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "claimed", label: "Claimed" }
];

const CATEGORY_OPTIONS = [
  { value: "", label: "No category yet" },
  ...BUSINESS_CATEGORY_VALUES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1)
  }))
];

const STATE_OPTIONS = [
  { value: "", label: "No state yet" },
  ...NIGERIAN_STATES
];

function formatNaira(kobo) {
  if (!Number.isFinite(kobo)) return "-";
  return `₦${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTimeLocal(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function StoresPageContent() {
  const { secureApiCall } = useAuth();
  const searchParams = useSearchParams();
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [platformModeFilter, setPlatformModeFilter] = useState("");
  const [claimStatusFilter, setClaimStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loadingKey, setLoadingKey] = useState(null);
  // Arriving from the suggestions review queue (/stores/suggestions'
  // "Create listing" link) pre-fills and opens the modal directly, so
  // staff don't have to retype what a visitor already told us. Lazy
  // initial state (not an effect) since this only ever matters once, on
  // the first render -- this page's own filter changes never touch these
  // params again.
  const [createModalOpen, setCreateModalOpen] = useState(() => Boolean(searchParams.get("prefillName")));
  const [createForm, setCreateForm] = useState(() => ({
    storeName: searchParams.get("prefillName") || "",
    businessCategory: "",
    state: "",
    storePhone: "",
    addressStreet: searchParams.get("prefillLocation") || "",
    storeDescription: ""
  }));
  const [createFormError, setCreateFormError] = useState("");
  const [pendingSuggestionId, setPendingSuggestionId] = useState(() => searchParams.get("suggestionId") || null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStore, setManualStore] = useState(null);
  const [manualForm, setManualForm] = useState({
    amountNaira: "5000",
    periodDays: "30",
    paidAt: formatDateTimeLocal(),
    reference: "",
    note: "",
  });
  const [manualFormError, setManualFormError] = useState("");

  // Reset to page 1 when filters change, following React's own
  // "adjusting state when a prop changes" pattern (setState during render,
  // guarded by a prev-value comparison) rather than an effect -- avoids a
  // second render pass just to reset a page number.
  const [prevFilters, setPrevFilters] = useState({ query, statusFilter, verifiedFilter, platformModeFilter, claimStatusFilter });
  if (query !== prevFilters.query || statusFilter !== prevFilters.statusFilter || verifiedFilter !== prevFilters.verifiedFilter || platformModeFilter !== prevFilters.platformModeFilter || claimStatusFilter !== prevFilters.claimStatusFilter) {
    setPrevFilters({ query, statusFilter, verifiedFilter, platformModeFilter, claimStatusFilter });
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
      if (params.claimStatus) search.set("claim_status", params.claimStatus);
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
    const timeout = setTimeout(() => load({ q: query, status: statusFilter, verified: verifiedFilter, platformMode: platformModeFilter, claimStatus: claimStatusFilter, page }), 300);
    return () => clearTimeout(timeout);
  }, [query, statusFilter, verifiedFilter, platformModeFilter, claimStatusFilter, page, load]);

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

  const openCreateModal = () => {
    setCreateForm({ storeName: "", businessCategory: "", state: "", storePhone: "", addressStreet: "", storeDescription: "" });
    setCreateFormError("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (loadingKey === "create-listing") return;
    setCreateModalOpen(false);
    setCreateFormError("");
  };

  const handleCreateFormChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    if (createFormError) setCreateFormError("");
  };

  const handleCreateListing = async (event) => {
    event.preventDefault();
    if (!createForm.storeName.trim()) {
      setCreateFormError("Business name is required.");
      return;
    }

    setLoadingKey("create-listing");
    try {
      const data = await secureApiCall("/api/stores", {
        method: "POST",
        body: JSON.stringify({
          storeName: createForm.storeName.trim(),
          businessCategory: createForm.businessCategory || null,
          state: createForm.state || null,
          storePhone: createForm.storePhone.trim() || null,
          addressStreet: createForm.addressStreet.trim() || null,
          storeDescription: createForm.storeDescription.trim() || null
        })
      });

      if (data.success) {
        setCreateModalOpen(false);
        if (pendingSuggestionId) {
          secureApiCall(`/api/business-suggestions/${pendingSuggestionId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "actioned" })
          }).catch((err) => console.error("Error marking suggestion actioned:", err));
          setPendingSuggestionId(null);
        }
        await load({ q: query, status: statusFilter, verified: verifiedFilter, platformMode: platformModeFilter, claimStatus: claimStatusFilter, page });
      }
    } catch (error) {
      console.error("Error creating unclaimed listing:", error);
      setCreateFormError(error?.message || "Failed to create listing.");
    } finally {
      setLoadingKey(null);
    }
  };

  const openManualActivationModal = (store) => {
    setManualStore(store);
    setManualForm({
      amountNaira: "5000",
      periodDays: "30",
      paidAt: formatDateTimeLocal(),
      reference: "",
      note: "",
    });
    setManualFormError("");
    setManualModalOpen(true);
  };

  const closeManualActivationModal = () => {
    if (manualStore && loadingKey === `subscription-${manualStore.id}`) return;
    setManualModalOpen(false);
    setManualStore(null);
    setManualFormError("");
  };

  const handleManualFormChange = (field, value) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
    if (manualFormError) setManualFormError("");
  };

  const handleActivateManualListingSubscription = async (event) => {
    event.preventDefault();
    if (!manualStore) return;

    const parsedAmount = Number(manualForm.amountNaira);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setManualFormError("Enter a valid amount in Naira.");
      return;
    }

    const parsedPeriodDays = Number(manualForm.periodDays);
    if (!Number.isFinite(parsedPeriodDays) || parsedPeriodDays < 1 || parsedPeriodDays > 365) {
      setManualFormError("Period must be between 1 and 365 days.");
      return;
    }

    if (!manualForm.paidAt) {
      setManualFormError("Select a payment date and time.");
      return;
    }

    setLoadingKey(`subscription-${manualStore.id}`);
    try {
      const data = await secureApiCall(`/api/stores/${manualStore.id}/subscription/manual`, {
        method: "POST",
        body: JSON.stringify({
          amountNaira: parsedAmount,
          currency: "NGN",
          periodDays: parsedPeriodDays,
          paidAt: new Date(manualForm.paidAt).toISOString(),
          reference: manualForm.reference.trim() || null,
          note: manualForm.note.trim() || null,
        })
      });

      if (data.success) {
        setStores((prev) =>
          prev.map((s) =>
            s.id === manualStore.id
              ? {
                  ...s,
                  subscriptionStatus: data.store.subscriptionStatus,
                  isPublished: data.store.isPublished,
                  isLive: data.store.isLive,
                }
              : s
          )
        );

        const completedStoreName = manualStore.storeName;
        closeManualActivationModal();
        window.alert(`Subscription activated for ${completedStoreName}. Recorded payment: ${formatNaira(data.payment.amountKobo)}.`);
      }
    } catch (error) {
      console.error("Error activating manual subscription:", error);
      setManualFormError(error?.message || "Failed to activate manual subscription.");
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
        <CustomDropdown options={CLAIM_STATUS_OPTIONS} value={claimStatusFilter} onChange={setClaimStatusFilter} className="w-full sm:w-44" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Link
            href="/stores/suggestions"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Lightbulb className="w-4 h-4" />
            Suggestions
          </Link>
          <Link
            href="/stores/disputes"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ShieldAlert className="w-4 h-4" />
            Reports
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            <Plus className="w-4 h-4" />
            New unclaimed listing
          </button>
        </div>
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
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 truncate">{store.storeName}</p>
                            {store.claimStatus === "unclaimed" && (
                              <span className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Unclaimed</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{store.storeSlug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{store.owner?.name || (store.claimStatus === "unclaimed" ? "No owner yet" : "—")}</p>
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
                              onClick={() => openManualActivationModal(store)}
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

      {manualModalOpen && manualStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            onClick={closeManualActivationModal}
            className="absolute inset-0 bg-black/45"
            aria-label="Close manual activation form"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Activate Listing Subscription</h3>
              <p className="mt-1 text-sm text-gray-500">
                Record an offline payment and activate subscription for <span className="font-medium text-gray-700">{manualStore.storeName}</span>.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleActivateManualListingSubscription}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Amount (Naira)</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={manualForm.amountNaira}
                    onChange={(e) => handleManualFormChange("amountNaira", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    placeholder="5000"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Subscription Period (Days)</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={manualForm.periodDays}
                    onChange={(e) => handleManualFormChange("periodDays", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Paid At</span>
                  <input
                    type="datetime-local"
                    value={manualForm.paidAt}
                    onChange={(e) => handleManualFormChange("paidAt", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Payment Reference (Optional)</span>
                  <input
                    type="text"
                    value={manualForm.reference}
                    onChange={(e) => handleManualFormChange("reference", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    placeholder="Bank transfer ref / POS slip"
                    maxLength={120}
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs font-medium text-gray-600">Internal Note (Optional)</span>
                <textarea
                  value={manualForm.note}
                  onChange={(e) => handleManualFormChange("note", e.target.value)}
                  className="w-full min-h-[84px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700 resize-y"
                  placeholder="How payment was received, who confirmed it, or any audit context"
                  maxLength={500}
                />
              </label>

              {manualFormError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{manualFormError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeManualActivationModal}
                  disabled={loadingKey === `subscription-${manualStore.id}`}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingKey === `subscription-${manualStore.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                >
                  {loadingKey === `subscription-${manualStore.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Payment & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            onClick={closeCreateModal}
            className="absolute inset-0 bg-black/45"
            aria-label="Close new listing form"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Unclaimed Listing</h3>
              <p className="mt-1 text-sm text-gray-500">
                Seeds a listing for a real business that hasn&apos;t signed up yet. It stays hidden from customers until claimed.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateListing}>
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-gray-600">Business Name</span>
                <input
                  type="text"
                  value={createForm.storeName}
                  onChange={(e) => handleCreateFormChange("storeName", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  placeholder="Bella's Cakes"
                  required
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Category</span>
                  <CustomDropdown
                    options={CATEGORY_OPTIONS}
                    value={createForm.businessCategory}
                    onChange={(v) => handleCreateFormChange("businessCategory", v)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">State</span>
                  <CustomDropdown
                    options={STATE_OPTIONS}
                    value={createForm.state}
                    onChange={(v) => handleCreateFormChange("state", v)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Phone (Optional)</span>
                  <input
                    type="text"
                    value={createForm.storePhone}
                    onChange={(e) => handleCreateFormChange("storePhone", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    placeholder="0803 xxx xxxx"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">Address (Optional)</span>
                  <input
                    type="text"
                    value={createForm.addressStreet}
                    onChange={(e) => handleCreateFormChange("addressStreet", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                    placeholder="Street address"
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs font-medium text-gray-600">Description (Optional)</span>
                <textarea
                  value={createForm.storeDescription}
                  onChange={(e) => handleCreateFormChange("storeDescription", e.target.value)}
                  className="w-full min-h-[70px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-700 resize-y"
                  placeholder="What this business sells/does"
                  maxLength={500}
                />
              </label>

              {createFormError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createFormError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={loadingKey === "create-listing"}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingKey === "create-listing"}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                >
                  {loadingKey === "create-listing" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoresPage() {
  return (
    <AdminLayout title="Vendors" subtitle="Every store on Stora — status, totals, and account control.">
      <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-brand-700 animate-spin" /></div>}>
        <StoresPageContent />
      </Suspense>
    </AdminLayout>
  );
}
