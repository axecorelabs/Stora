"use client";
import { useMemo } from "react";
import { Package } from "lucide-react";
import ChartCardHeader from "./ChartCardHeader";

const BRAND = "#0F4A38";
const MAX_SLOTS = 5;

function buildRows(categories) {
  const sorted = [...categories]
    .map((c) => ({ name: c.category || "Uncategorized", value: Number(c.totalStock) || 0 }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= MAX_SLOTS) return sorted;

  const head = sorted.slice(0, MAX_SLOTS - 1);
  const tail = sorted.slice(MAX_SLOTS - 1);
  const otherTotal = tail.reduce((sum, r) => sum + r.value, 0);
  // A real category can itself be named "Other" -- merge into it rather
  // than adding a second row with the same key.
  const existingOther = head.find((r) => r.name === "Other");
  if (existingOther) {
    existingOther.value += otherTotal;
    return head;
  }
  return [...head, { name: "Other", value: otherTotal }];
}

export default function CategoryBreakdownChart({ categories = [], onViewMore }) {
  const rows = useMemo(() => buildRows(categories), [categories]);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const hasData = rows.some((r) => r.value > 0);

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 h-full flex flex-col">
      <ChartCardHeader icon={Package} title="Top categories" onViewMore={onViewMore} />

      {hasData ? (
        <div className="flex-1 flex flex-col justify-center gap-4 mt-4 lg:mt-5">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-gray-700 truncate">{row.name}</span>
                <span className="text-sm font-semibold text-gray-900 shrink-0 ml-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {row.value} units
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(row.value / max) * 100}%`, backgroundColor: BRAND }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">No inventory yet</p>
        </div>
      )}
    </div>
  );
}
