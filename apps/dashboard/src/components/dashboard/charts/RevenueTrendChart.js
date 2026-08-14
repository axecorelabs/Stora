"use client";
import { TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartTooltip from "./ChartTooltip";
import ChartCardHeader from "./ChartCardHeader";

const BRAND = "#0F4A38";

function formatCompactNaira(value) {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return `₦${Math.round(value)}`;
}

function formatDayTick(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function RevenueTrendChart({ data = [], growth = 0, onViewMore, rangeLabel = "last 14 days" }) {
  const total = data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const isUp = growth >= 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full flex flex-col">
      <ChartCardHeader icon={TrendingUp} title="Revenue" onViewMore={onViewMore} />

      <div className="flex items-baseline gap-2 mt-4">
        <p className="text-2xl font-bold text-gray-900">{formatCompactNaira(total)}</p>
        {growth !== 0 && (
          <span className={`flex items-center text-xs font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
            {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(growth)}%
          </span>
        )}
        <span className="text-xs text-gray-400">{rangeLabel}</span>
      </div>

      <div className="flex-1 min-h-56 mt-4 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.18} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayTick}
              tickLine={false}
              axisLine={false}
              interval={2}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
              tickFormatter={formatCompactNaira}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={48}
            />
            <Tooltip
              content={
                <ChartTooltip formatValue={formatCompactNaira} color={BRAND} />
              }
              labelFormatter={formatDayTick}
              cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#revenueFill)"
              activeDot={{ r: 4, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
