// Entries render into server-built HTML template literals (no build step,
// no framework) -- every interpolated field that came from user input
// (display_name, lagos_life_handle) MUST go through this before landing
// in markup.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString('en-NG')}`;
}
