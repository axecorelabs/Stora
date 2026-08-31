// Shared between PrefetchLink.js (reports pending state in) and
// NavigationLoadingOverlay.js (reads the aggregate out) -- kept as its own
// module rather than folded into either so neither has to import the
// other. A count, not a boolean: nothing stops two PrefetchLinks from
// being mid-navigation at once in principle (rapid clicks, or a second
// tap before the first settles), so "any pending" has to survive one of
// them finishing before the other does.
let pendingCount = 0;
const listeners = new Set();

export function reportLinkPending(isPending) {
  pendingCount = Math.max(0, pendingCount + (isPending ? 1 : -1));
  const anyPending = pendingCount > 0;
  listeners.forEach((fn) => fn(anyPending));
}

export function subscribeLinkPending(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
