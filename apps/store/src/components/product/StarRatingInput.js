"use client";
import { useState } from "react";
import { Star } from "lucide-react";

// Click-to-select star picker for the write-a-review form. Separate from
// ui/StarRating.js (that one's read-only display, this one's interactive)
// rather than overloading one component with an edit mode.
export default function StarRatingInput({ value, onChange, size = 28 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="p-0.5"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star
            width={size}
            height={size}
            className={display >= n ? "" : "text-gray-200"}
            style={display >= n ? { color: "#D8BC85" } : undefined}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
    </div>
  );
}
