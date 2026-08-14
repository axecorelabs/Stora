"use client";
import { ClipboardList } from "lucide-react";
import ChartCardHeader from "./ChartCardHeader";

// completedOrders is deliberately omitted: the orders/stats endpoint derives it
// as an alias of deliveredOrders (same underlying status), so including both
// would double-count the same orders in this breakdown.
const STATUS_CONFIG = [
  { key: "pendingOrders", label: "Pending", color: "#AD874A" },
  { key: "confirmedOrders", label: "Confirmed", color: "#5B8A7A" },
  { key: "processingOrders", label: "Processing", color: "#0F4A38" },
  { key: "shippedOrders", label: "Shipped", color: "#0B3B2E" },
  { key: "deliveredOrders", label: "Delivered", color: "#16A34A" },
  { key: "cancelledOrders", label: "Cancelled", color: "#DC2626" },
  { key: "refundedOrders", label: "Refunded", color: "#9CA3AF" },
];

export default function OrderStatusBreakdown({ stats, onViewMore }) {
  const rows = STATUS_CONFIG
    .map((s) => ({ ...s, value: Number(stats?.[s.key]) || 0 }))
    .filter((r) => r.value > 0);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = Number(stats?.totalOrders) || 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full flex flex-col">
      <ChartCardHeader icon={ClipboardList} title="Order status" onViewMore={onViewMore} tone="gold" />

      {rows.length > 0 ? (
        <>
          <p className="text-2xl font-bold text-gray-900 mt-4">
            {total}
            <span className="text-sm font-normal text-gray-400 ml-1.5">total orders</span>
          </p>
          <div className="flex-1 flex flex-col justify-center gap-3 mt-5">
            {rows.map((row) => (
              <div key={row.key}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-gray-700">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.value}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">No orders yet</p>
        </div>
      )}
    </div>
  );
}
