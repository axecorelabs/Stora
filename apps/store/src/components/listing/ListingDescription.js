"use client";

import { useMemo, useState } from "react";

function buildPreview(text, maxChars) {
  if (!text || text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

export default function ListingDescription({
  text,
  className = "",
  maxChars = 240
}) {
  const [expanded, setExpanded] = useState(false);

  const normalized = (text || "").trim();
  const isLong = normalized.length > maxChars;
  const preview = useMemo(() => buildPreview(normalized, maxChars), [normalized, maxChars]);

  if (!normalized) return null;

  return (
    <div className="mt-4 max-w-3xl sm:mt-6">
      <p className={className}>
        {expanded || !isLong ? normalized : `${preview}...`}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold text-brand-800 hover:text-brand-900 sm:text-sm"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
