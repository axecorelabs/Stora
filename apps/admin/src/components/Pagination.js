"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Server-paginated footer -- mirrors apps/dashboard's own inventory-page
// pagination styling, just driven by an offset/total from the API
// instead of a client-side slice.
export default function Pagination({ page, pageSize, total, onPrev, onNext }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-xs md:text-sm text-gray-500">
        {total === 0 ? "No results" : `${rangeStart}–${rangeEnd} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs md:text-sm text-gray-600 px-1 whitespace-nowrap">
          Page <span className="font-semibold text-gray-900">{page}</span> of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
