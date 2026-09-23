// Shared by every dashboard stat strip (Overview, Inventory, Payments,
// Sales, Orders, Services): on mobile they lay out as a 2-column bento
// instead of one straight vertical line. When the total count is odd, the
// last card has no neighbor to sit beside, so it spans both columns
// instead of being left dangling alone in its row. `sm:col-span-1` resets
// it back to a normal cell at every larger breakpoint, where each page's
// own column count already takes over.
export function bentoLastSpanClass(index, total) {
  return total % 2 === 1 && index === total - 1 ? "col-span-2 sm:col-span-1" : "";
}
