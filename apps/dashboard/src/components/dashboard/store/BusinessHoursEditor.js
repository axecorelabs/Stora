"use client";
import { DAYS_OF_WEEK, DEFAULT_DAY_HOURS } from "@stora/shared-constants";

// Editable form -- one row per day, a closed/open toggle, and two time
// inputs that only show while that day's open. Reuses EditStoreModal's
// existing generic handleChange (its 3-level dot-path branch already
// handles `businessHours.<day>.<field>` correctly) rather than introducing
// a separate setter just for this field, so this stays a plain controlled
// input like everything else on the General tab.
//
// Below `sm`, the day label + toggle sit on their own header row and the
// time inputs (or "Closed") drop to a second, full-width line -- the
// original single-row layout packed a fixed-width label, a toggle, and two
// native <input type="time"> fields (which have a real minimum width
// browsers won't shrink below) into one line, which fit on a wide desktop
// panel but not inside the Edit Store modal's narrower mobile width; it
// either overflowed the card or squeezed the time pickers down to where
// their own native controls got clipped. The day-label/toggle wrapper uses
// `sm:contents` so it disappears as a box at `sm` and up, letting its two
// children rejoin the row as direct flex items in the same order they'd
// have had without the wrapper -- the desktop layout is unchanged.
export default function BusinessHoursEditor({ businessHours, handleChange }) {
  return (
    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const dayHours = businessHours?.[key] || DEFAULT_DAY_HOURS;
        const isOpen = !dayHours.closed;

        return (
          <div key={key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center justify-between sm:contents">
              <span className="text-sm font-medium text-gray-700 sm:w-24 sm:flex-shrink-0">{label}</span>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) =>
                    handleChange({ target: { name: `businessHours.${key}.closed`, value: !e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-800" />
              </label>
            </div>

            {isOpen ? (
              <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:min-w-[220px]">
                <input
                  type="time"
                  value={dayHours.open || ''}
                  onChange={(e) => handleChange({ target: { name: `businessHours.${key}.open`, value: e.target.value } })}
                  className="flex-1 min-w-0 sm:flex-initial px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-black focus:ring-2 focus:ring-brand-800 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm flex-shrink-0">to</span>
                <input
                  type="time"
                  value={dayHours.close || ''}
                  onChange={(e) => handleChange({ target: { name: `businessHours.${key}.close`, value: e.target.value } })}
                  className="flex-1 min-w-0 sm:flex-initial px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-black focus:ring-2 focus:ring-brand-800 focus:border-transparent"
                />
              </div>
            ) : (
              <span className="text-sm text-gray-400 sm:flex-1">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
