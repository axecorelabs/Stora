"use client";
import ExtrasSelector from "@/components/product/ExtrasSelector";

const MAX_CUSTOMIZE_EACH_QUANTITY = 10;

// Quantity and extras used to be two independent controls -- quantity=2
// meant BOTH units got whatever one extras selection was made, with no way
// to say "one with extra sausage, one plain." This renders the real fix:
// `unitConfigs` (one {extras, note} entry per unit, always `quantity`
// long) is the only state; `sameForAll` is a WRITE MODE over it, not a
// second parallel shape -- true mirrors one shared selector's output into
// every entry, false lets each unit's panel write only its own entry.
// Presentational only, same ownership contract as ExtrasSelector.js: the
// caller owns all state and passes it back through the on*Change props.
export default function UnitExtrasConfigurator({
  quantity,
  extrasDefinitions,
  unitConfigs,
  sameForAll,
  onSameForAllChange,
  onSharedExtrasChange,
  onSharedNoteChange,
  onUnitExtrasChange,
  onUnitNoteChange,
  submittedCount = 0,
  formatPrice,
  primaryColor,
  notePlaceholder
}) {
  const hasExtras = extrasDefinitions.length > 0;
  const showToggle = quantity >= 2 && hasExtras;
  const canCustomizeEach = quantity <= MAX_CUSTOMIZE_EACH_QUANTITY;

  const renderNote = (value, onChange, disabled, idPrefix) => (
    <div>
      <label htmlFor={`${idPrefix}-note`} className="text-sm font-semibold text-gray-900 mb-2 block">
        Note for the seller <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <textarea
        id={`${idPrefix}-note`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={notePlaceholder}
        rows={2}
        maxLength={300}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );

  // Single shared block -- quantity 1, or quantity >= 2 with "same for
  // all" selected (the common case: identical items, no new friction).
  if (!showToggle || sameForAll) {
    const shared = unitConfigs[0] || { extras: {}, note: '' };
    return (
      <div className="space-y-4">
        {showToggle && (
          <SameForAllToggle sameForAll={sameForAll} onChange={onSameForAllChange} canCustomizeEach={canCustomizeEach} />
        )}
        <ExtrasSelector
          extrasDefinitions={extrasDefinitions}
          selectedExtras={shared.extras}
          onChange={onSharedExtrasChange}
          formatPrice={formatPrice}
          primaryColor={primaryColor}
        />
        {renderNote(shared.note, onSharedNoteChange, false, 'shared')}
      </div>
    );
  }

  // Per-unit panels -- "Customize each item separately."
  return (
    <div className="space-y-4">
      <SameForAllToggle sameForAll={sameForAll} onChange={onSameForAllChange} canCustomizeEach={canCustomizeEach} />
      <div className="space-y-4">
        {unitConfigs.map((cfg, index) => {
          const isCommitted = index < submittedCount;
          return (
            <div
              key={index}
              className={`rounded-xl border p-3.5 space-y-3 ${isCommitted ? 'border-brand-100 bg-brand-50/40' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Item {index + 1} of {quantity}</p>
                {isCommitted && (
                  <span className="text-xs font-medium text-brand-700">✓ Added</span>
                )}
              </div>
              <ExtrasSelector
                extrasDefinitions={extrasDefinitions}
                selectedExtras={cfg.extras}
                onChange={(next) => onUnitExtrasChange(index, next)}
                formatPrice={formatPrice}
                primaryColor={primaryColor}
              />
              {renderNote(cfg.note, (next) => onUnitNoteChange(index, next), isCommitted, `unit-${index}`)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SameForAllToggle({ sameForAll, onChange, canCustomizeEach }) {
  return (
    <div>
      <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${sameForAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          Same for all
        </button>
        <button
          type="button"
          onClick={() => canCustomizeEach && onChange(false)}
          disabled={!canCustomizeEach}
          title={canCustomizeEach ? undefined : 'Reduce quantity to 10 or fewer to customize each item'}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${!sameForAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          Customize each
        </button>
      </div>
      {!canCustomizeEach && (
        <p className="text-xs text-gray-400 mt-1.5">Customize each item is available up to 10 items -- reduce quantity or add this in two batches.</p>
      )}
    </div>
  );
}
