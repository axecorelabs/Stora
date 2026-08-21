"use client";
import { useState } from "react";
import { SlidersHorizontal, ArrowUpDown, Check, Search as SearchIcon, Truck } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_BUCKETS } from "./PriceFilterPills";
import { NIGERIAN_STATES } from "@stora/shared-constants";

// Replaces the desktop toolbar's stacked rows (category pills, state
// token, price pills, sort buttons) with two compact triggers below the
// `sm` breakpoint. Those rows were measured overlapping/overflowing on a
// 390px viewport once price and sort shared one "opposite corners" row
// with no room for both -- collapsing everything into two sheets fixes
// that and cuts the chrome above the results grid from ~480px down to
// one ~44px row. `onPriceChange` omitted (vendors has no price filter)
// hides that section entirely, same convention as SearchConsole.
export default function MobileFilterBar({
  categories, onCategoriesChange,
  state, onStateChange,
  priceKey, onPriceChange,
  sort, onSortChange, sortOptions,
  deliveryState, onDeliveryStateChange,
  deliverableOnly, onDeliverableOnlyChange,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const [pickingNearestState, setPickingNearestState] = useState(false);
  const [pickingDeliverableState, setPickingDeliverableState] = useState(false);

  const toggleCategory = (value) => {
    onCategoriesChange(
      categories.includes(value) ? categories.filter((c) => c !== value) : [...categories, value]
    );
  };

  // Same "need a state first" gate the desktop toggle uses -- this filter
  // is a no-op without one to filter against.
  const toggleDeliverable = () => {
    if (deliverableOnly) {
      onDeliverableOnlyChange(false);
      return;
    }
    if (!deliveryState) {
      setPickingDeliverableState(true);
      return;
    }
    onDeliverableOnlyChange(true);
  };

  const activeCount = categories.length + [state, priceKey, deliverableOnly ? true : null].filter(Boolean).length;
  const activeSortLabel = sortOptions.find((s) => s.key === sort)?.label || sortOptions[0]?.label;

  const filteredStates = stateQuery.trim()
    ? NIGERIAN_STATES.filter((s) => s.label.toLowerCase().includes(stateQuery.trim().toLowerCase()))
    : NIGERIAN_STATES;

  const closeFilters = () => {
    setShowFilters(false);
    setPickingDeliverableState(false);
  };
  const closeSort = () => {
    setShowSort(false);
    setPickingNearestState(false);
  };

  const pillClass = (active) =>
    `px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
      active ? "bg-brand-700 text-white border-brand-700" : "bg-white text-brand-800 border-brand-100"
    }`;

  return (
    <>
      <div className="sm:hidden flex items-center gap-2 mb-6">
        <button
          onClick={() => setShowFilters(true)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            activeCount > 0 ? "bg-brand-50 border-brand-300 text-brand-900" : "bg-white border-gray-200 text-brand-800"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-700 text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowSort(true)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-brand-800"
        >
          <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{activeSortLabel}</span>
        </button>
      </div>

      <BottomSheet
        isOpen={showFilters}
        onClose={closeFilters}
        title="Filters"
        footer={
          <div className="flex items-center gap-4">
            {activeCount > 0 && (
              <button
                onClick={() => {
                  onCategoriesChange([]);
                  onStateChange("");
                  onPriceChange?.("");
                  onDeliverableOnlyChange(false);
                }}
                className="text-sm font-semibold text-gray-500 flex-shrink-0"
              >
                Clear all
              </button>
            )}
            <button onClick={closeFilters} className="flex-1 py-3 rounded-xl bg-brand-700 text-white text-sm font-semibold">
              Show results
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Category</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onCategoriesChange([])} className={pillClass(categories.length === 0)}>
                All
              </button>
              {CATEGORIES.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => toggleCategory(value)}
                  className={`flex items-center gap-1.5 ${pillClass(categories.includes(value))}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {value}
                </button>
              ))}
            </div>
          </div>

          {onPriceChange && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Price</p>
              <div className="flex flex-wrap gap-2">
                {PRICE_BUCKETS.map((b) => (
                  <button key={b.key} onClick={() => onPriceChange(priceKey === b.key ? "" : b.key)} className={pillClass(priceKey === b.key)}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Delivery</p>
            {pickingDeliverableState ? (
              <div>
                <p className="text-sm text-gray-500 mb-2.5">Pick your state to filter by it.</p>
                <div className="max-h-52 overflow-y-auto -mx-1 px-1">
                  {NIGERIAN_STATES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => {
                        onDeliveryStateChange(s.value);
                        onDeliverableOnlyChange(true);
                        setPickingDeliverableState(false);
                      }}
                      className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-left text-gray-900 hover:bg-gray-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={toggleDeliverable}
                className={`w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  deliverableOnly ? "bg-brand-50 border-brand-300 text-brand-900" : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                <Truck className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">
                  {deliveryState ? `Only stores that deliver to ${deliveryState}` : "Only stores that deliver to me"}
                </span>
                {deliverableOnly && <Check className="w-4 h-4 text-brand-700 flex-shrink-0" />}
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2.5">State</p>
            <div className="relative mb-2">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={stateQuery}
                onChange={(e) => setStateQuery(e.target.value)}
                placeholder="Search states…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
            <div className="max-h-52 overflow-y-auto -mx-1 px-1">
              <button
                onClick={() => onStateChange("")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-900 hover:bg-gray-50"
              >
                Any state
                {!state && <Check className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />}
              </button>
              {filteredStates.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">No states match &ldquo;{stateQuery}&rdquo;</p>
              ) : (
                filteredStates.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => onStateChange(s.value)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left text-gray-900 hover:bg-gray-50"
                  >
                    {s.label}
                    {state === s.value && <Check className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={showSort} onClose={closeSort} title="Sort by">
        {!pickingNearestState ? (
          <div className="space-y-1">
            {sortOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  if (s.key === "nearest" && !deliveryState) {
                    setPickingNearestState(true);
                    return;
                  }
                  onSortChange(s.key);
                  closeSort();
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors ${
                  sort === s.key ? "bg-brand-50 text-brand-900" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {s.label}
                {sort === s.key && <Check className="w-4 h-4 text-brand-700 flex-shrink-0" />}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Pick your state to sort by nearest first.</p>
            <div className="max-h-64 overflow-y-auto -mx-1 px-1">
              {NIGERIAN_STATES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    onDeliveryStateChange(s.value);
                    onSortChange("nearest");
                    closeSort();
                  }}
                  className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-left text-gray-900 hover:bg-gray-50"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
