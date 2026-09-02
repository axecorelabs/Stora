"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, Package, ShoppingCart, TrendingUp, Sparkles, ArrowUpRight, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import RevenueTrendChart from "@/components/charts/RevenueTrendChart";
import OrdersTrendChart from "@/components/charts/OrdersTrendChart";
import CategoryBreakdownChart from "@/components/charts/CategoryBreakdownChart";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0
  }).format(amount || 0);
}

function getCurrentDate() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function OverviewPageContent() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await secureApiCall("/api/overview");
        if (data.success) setOverview(data.overview);
      } catch (error) {
        console.error("Error loading overview:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [secureApiCall]);

  if (loading || !overview) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
      </div>
    );
  }

  const statRows = [
    {
      key: "vendors",
      icon: Store,
      tone: "brand",
      label: "Vendors",
      value: overview.vendors.total,
      sub: `${overview.vendors.active} active`,
      onClick: () => router.push("/stores")
    },
    {
      key: "products",
      icon: Package,
      tone: "brand",
      label: "Products",
      value: overview.products.total,
      sub: `${overview.products.active} active`,
      onClick: () => router.push("/products")
    },
    {
      key: "orders",
      icon: ShoppingCart,
      tone: "gold",
      label: "Orders",
      value: overview.orders.total,
      sub: `${overview.orders.today} placed today`
    },
    {
      key: "revenue",
      icon: TrendingUp,
      tone: "gold",
      label: "Revenue",
      value: formatCurrency(overview.revenue.total),
      sub: "all-time, platform-wide"
    }
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl"></div>

        <img
          src="/stora.png"
          alt=""
          aria-hidden="true"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 lg:w-80 lg:h-80 object-contain opacity-10 pointer-events-none select-none"
        />

        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-3 lg:mb-4">
            <Sparkles className="w-5 h-5 text-gold-500" />
            <p className="text-gold-500 text-sm font-semibold tracking-wide">Stora Admin</p>
          </div>
          <h1 className="text-2xl lg:text-4xl font-bold text-white mb-2 lg:mb-3 leading-tight">
            Platform<br />
            <span className="text-gold-500">Overview</span>
          </h1>
          <p className="text-sm lg:text-base text-gray-300 max-w-md">{getCurrentDate()}</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-gray-100">
          {statRows.map((row) => {
            const Icon = row.icon;
            const Wrapper = row.onClick ? "button" : "div";
            return (
              <Wrapper
                key={row.key}
                onClick={row.onClick}
                className={`text-left p-4 lg:p-5 ${row.onClick ? "hover:bg-gray-50 transition-colors" : ""}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${row.tone === "gold" ? "bg-gold-500/15 text-gold-600" : "bg-brand-100 text-brand-800"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{row.label}</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {row.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{row.sub}</p>
              </Wrapper>
            );
          })}
        </div>
      </div>

      {/* Revenue + top categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 h-full">
          <RevenueTrendChart data={overview.trend} onViewMore={() => router.push("/stores")} />
        </div>
        <CategoryBreakdownChart categories={overview.topCategories} onViewMore={() => router.push("/products")} />
      </div>

      {/* Orders + recent signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <OrdersTrendChart data={overview.trend} />

        <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6 h-[380px] lg:h-[420px] flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-brand-100 text-brand-800">
                <Users className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold text-gray-900">Recent signups</h3>
            </div>
            <button
              onClick={() => router.push("/stores")}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-800 transition-colors"
            >
              View more
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mt-4 divide-y divide-gray-50">
            {overview.recentVendors.length > 0 ? (
              overview.recentVendors.map((vendor) => (
                <div key={vendor.storeSlug} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{vendor.storeName}</p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(vendor.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{vendor.storeSlug}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="w-9 h-9 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No vendors yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <AdminLayout title="Overview" subtitle="How Stora is doing, platform-wide.">
      <OverviewPageContent />
    </AdminLayout>
  );
}
