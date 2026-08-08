// Shared tooltip: value leads (bold, high-contrast), label follows (secondary).
// A short line-key (not a filled box) ties the row back to its series color.
export default function ChartTooltip({ active, payload, label, formatValue, color = "#0F4A38" }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3.5 py-2.5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-0.5 rounded-full"
            style={{ backgroundColor: entry.color || color }}
          />
          <span className="text-sm font-semibold text-gray-900">
            {formatValue ? formatValue(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
