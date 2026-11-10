"use client";
import { FileClock } from "lucide-react";

function timeAgo(ms) {
  if (!ms) return 'a moment ago';
  const diffMinutes = Math.round((Date.now() - ms) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

// Shown once, above the form, when an unfinished draft exists from a
// previous visit -- never auto-applied (see useInventoryDraft's readyRef
// gate), since silently resurrecting old state would be more surprising
// than helpful. Stacks to full-width buttons below sm, same convention
// as the form's own navigation footer.
export default function ResumeDraftBanner({ productName, savedAt, onResume, onDiscard }) {
  return (
    <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1">
        <FileClock className="w-5 h-5 text-brand-700 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-brand-900">
            You have an unsaved product from {timeAgo(savedAt)}
          </p>
          <p className="text-sm text-brand-700">
            {productName || 'Untitled product'}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onResume}
          className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-white bg-brand-800 rounded-lg hover:bg-brand-900 transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  );
}
