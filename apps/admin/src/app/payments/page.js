"use client";
import { useEffect, useState } from "react";
import { Loader2, Wallet, TrendingUp, Clock, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import StatStrip from "@/components/StatStrip";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount || 0);
}

function PaymentsPageContent() {
  const { secureApiCall } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await secureApiCall("/api/payments/overview");
        if (result.success) setData(result);
      } catch (error) {
        console.error("Error loading payments overview:", error);
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

  const { stats, vendorPayouts, commissionRate } = data;

  const statRows = [
    { key: "commission", icon: Wallet, tone: "gold", label: "Commission earned", value: formatCurrency(stats.totalCommission), sub: `${(commissionRate * 100).toFixed(0)}% base rate` },
    { key: "paidOut", icon: TrendingUp, tone: "brand", label: "Paid out to vendors", value: formatCurrency(stats.totalPaidOut), sub: "settled to bank" },
    { key: "pending", icon: Clock, tone: "brand", label: "Pending payout", value: formatCurrency(stats.totalPendingPayout), sub: "awaiting settlement" },
    { key: "refunded", icon: RotateCcw, tone: "gold", label: "Refunded", value: formatCurrency(stats.totalRefunded), sub: `${stats.transactionCount} transactions` }
  ];

  return (
    <div className="space-y-4">
      <StatStrip rows={statRows} />

      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium text-right">Gross</th>
              <th className="px-4 py-3 font-medium text-right">Commission</th>
              <th className="px-4 py-3 font-medium text-right">Net to vendor</th>
              <th className="px-4 py-3 font-medium text-right">Pending payout</th>
              <th className="px-4 py-3 font-medium text-right">Refunded</th>
              <th className="px-4 py-3 font-medium text-right">Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {vendorPayouts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-sm text-gray-400 text-center">No Paystack-processed payments yet.</td>
              </tr>
            )}
            {vendorPayouts.map((v) => (
              <tr key={v.storeId} className="hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{v.storeName}</p>
                  <p className="text-xs text-gray-400">{v.storeSlug}</p>
                </td>
                <td className="px-4 py-3 text-right text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(v.gross)}</td>
                <td className="px-4 py-3 text-right text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(v.commission)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(v.net)}</td>
                <td className="px-4 py-3 text-right text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {v.pendingPayout > 0 ? formatCurrency(v.pendingPayout) : "—"}
                </td>
                <td className="px-4 py-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {v.refunded > 0 ? <span className="text-red-600">{formatCurrency(v.refunded)}</span> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-500" style={{ fontVariantNumeric: "tabular-nums" }}>{v.transactionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <AdminLayout title="Payments" subtitle="What Stora has collected, kept, and paid out.">
      <PaymentsPageContent />
    </AdminLayout>
  );
}
