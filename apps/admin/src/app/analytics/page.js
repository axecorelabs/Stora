"use client";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Calendar, CalendarDays, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import StatStrip from "@/components/StatStrip";
import RevenueTrendChart from "@/components/charts/RevenueTrendChart";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount || 0);
}

function AnalyticsPageContent() {
  const { secureApiCall } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await secureApiCall("/api/analytics/overview");
        if (result.success) setData(result);
      } catch (error) {
        console.error("Error loading analytics:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [secureApiCall]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-5 h-5 text-brand-700 animate-spin" />
      </div>
    );
  }

  const volumeRows = [
    { key: "today", icon: Calendar, tone: "brand", label: "Processed today", value: formatCurrency(data.todayVolume), sub: "Paystack-processed" },
    { key: "month", icon: CalendarDays, tone: "brand", label: "Processed this month", value: formatCurrency(data.monthVolume), sub: "Paystack-processed" }
  ];

  const mrrRows = [
    { key: "mrr-commission", icon: TrendingUp, tone: "gold", label: "Commission run-rate (MRR)", value: formatCurrency(data.mrr.commissionRunRate), sub: "trailing 30 days, as a monthly run-rate" },
    { key: "arr-commission", icon: TrendingUp, tone: "gold", label: "Commission run-rate (ARR)", value: formatCurrency(data.arr.commissionRunRate), sub: "annualized run-rate estimate" },
    { key: "mrr-sub", icon: BarChart3, tone: "brand", label: "Subscription MRR", value: formatCurrency(data.mrr.subscription), sub: "literal, from active subscriptions" },
    { key: "arr-sub", icon: BarChart3, tone: "brand", label: "Subscription ARR", value: formatCurrency(data.arr.subscription), sub: "₦0 until paid plans launch" }
  ];

  return (
    <div className="space-y-4">
      <StatStrip rows={volumeRows} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueTrendChart data={data.trend} rangeLabel="last 30 days" />

        <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top vendors by processed volume</h3>
          {data.topStores.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No Paystack-processed volume yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.topStores.map((store, i) => (
                <div key={store.storeId} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{store.storeName}</p>
                      <p className="text-xs text-gray-400 truncate">{store.storeSlug}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 shrink-0 ml-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(store.volume)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <StatStrip rows={mrrRows} />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AdminLayout title="Analytics" subtitle="Processing volume, run-rate revenue, and top vendors.">
      <AnalyticsPageContent />
    </AdminLayout>
  );
}
