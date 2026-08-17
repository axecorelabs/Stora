"use client";
import { Star } from "lucide-react";

// Read-only star display, reused across the product page, store hero, and
// review list -- one rendering so a 4.3 always looks the same everywhere
// (rounds to the nearest half-star visually via a clipped overlay, rather
// than only ever showing whole stars).
export default function StarRating({ rating = 0, size = 14, color = "#D8BC85" }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const pct = (clamped / 5) * 100;

  return (
    <span className="relative inline-flex" style={{ width: size * 5, height: size }}>
      <span className="absolute inset-0 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} width={size} height={size} className="text-gray-200" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
      <span className="absolute inset-0 flex gap-0.5 overflow-hidden" style={{ width: `${pct}%` }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} width={size} height={size} style={{ color }} fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  );
}
