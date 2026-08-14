"use client";
import { Award } from "lucide-react";
import ChartCardHeader from "./ChartCardHeader";

function formatCompactNaira(value) {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return `₦${Math.round(value)}`;
}

export default function TopProductsCard({ products = [], onViewMore }) {
  const max = Math.max(...products.map((p) => p.revenue || 0), 1);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full flex flex-col">
      <ChartCardHeader icon={Award} title="Top selling products" onViewMore={onViewMore} />

      {products.length > 0 ? (
        <div className="flex-1 flex flex-col gap-4 mt-5">
          {products.map((product, index) => (
            <div key={product.inventoryId || product.sku || index} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-50 text-brand-800 text-xs font-bold shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-sm text-gray-800 truncate">{product.productName || "Unknown item"}</span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCompactNaira(product.revenue)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-800"
                    style={{ width: `${(product.revenue / max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{product.quantitySold} sold</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">No sales yet</p>
        </div>
      )}
    </div>
  );
}
