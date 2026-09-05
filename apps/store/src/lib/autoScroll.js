// Slow, continuous auto-scroll for a horizontal shelf -- bounces back and
// forth between the two ends rather than snapping back to the start, so
// reaching an edge doesn't produce a jarring jump. `el` is read fresh from
// the ref inside the effect (not passed in), and pause/resume are plain
// functions closed over the same ref rather than a returned object from a
// shared custom hook -- eslint's react-hooks/refs rule flags a
// ref-mutating callback returned FROM a custom hook as "accessed during
// render" even though it's only ever invoked from an event handler, so
// this stays a plain function each call site wires up itself (the
// homepage category shelf, the homepage AI-suggestions row, the hero's own
// AI-template row) instead of being a hook.
export function attachAutoScroll(ref, pausedRef, directionRef, speedPxPerFrame) {
  const el = ref.current;
  if (!el) return () => {};

  let frameId;
  const step = () => {
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (!pausedRef.current && maxScroll > 0) {
      let next = el.scrollLeft + speedPxPerFrame * directionRef.current;
      if (next >= maxScroll) {
        next = maxScroll;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      el.scrollLeft = next;
    }
    frameId = requestAnimationFrame(step);
  };
  frameId = requestAnimationFrame(step);

  return () => cancelAnimationFrame(frameId);
}
