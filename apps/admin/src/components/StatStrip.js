"use client";

// Reusable version of Overview's stat-strip block -- icon + label + value
// + sub, in a bordered card with divider lines between cells. Rows are
// buttons when `onClick` is set, plain cells otherwise.
//
// Tailwind's class scanner needs literal class strings, not interpolated
// ones -- so the lg:grid-cols-N value is picked from this fixed map
// rather than built with a template literal.
const LG_COLS = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

export default function StatStrip({ rows }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className={`grid grid-cols-2 ${LG_COLS[rows.length] || "lg:grid-cols-4"} divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-gray-100`}>
        {rows.map((row) => {
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
              {row.sub && <p className="text-xs text-gray-400 mt-1">{row.sub}</p>}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
