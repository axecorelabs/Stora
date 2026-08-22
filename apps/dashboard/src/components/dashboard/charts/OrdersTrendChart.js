"use client";
import { ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import ChartTooltip from "./ChartTooltip";
import ChartCardHeader from "./ChartCardHeader";

const GOLD = "#AD874A";

function formatDayTick(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function OrdersTrendChart({ data = [], onViewMore }) {
  const total = data.reduce((sum, d) => sum + (d.orders || 0), 0);
  const average = data.length > 0 ? total / data.length : 0;

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-200 h-full flex flex-col">
      <ChartCardHeader icon={ShoppingCart} title="Orders" onViewMore={onViewMore} tone="gold" />

      <div className="flex items-baseline gap-2 mt-4">
        <p className="text-xl lg:text-2xl font-bold text-gray-900">{total}</p>
        <span className="text-xs text-gray-400">last 14 days</span>
      </div>

      <div className="flex-1 min-h-48 lg:min-h-56 mt-4 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
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
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={32}
            />
            {average > 0 && (
              <ReferenceLine
                y={average}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{ value: "Avg", position: "insideLeft", fontSize: 10, fill: "#9ca3af" }}
              />
            )}
            <Tooltip
              content={<ChartTooltip color={GOLD} />}
              labelFormatter={formatDayTick}
              cursor={{ fill: "#FBF3E7" }}
            />
            <Bar dataKey="orders" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
