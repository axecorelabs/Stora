// Turns an arbitrary vendor-chosen accent color into a small set of
// premium-safe derived values. Unlike a normal single-brand page, this
// storefront's "brand color" is a different hex per vendor -- so instead
// of hardcoding one palette, every visual decision that depends on the
// accent has to hold up for whichever color a given vendor picked.
//
// The string-concatenated hex+alpha pattern used throughout this app's
// history (`${primaryColor}66`) gets two things wrong: it treats every
// accent as equally light or dark, so pale yellow behind white button
// text is unreadable while navy is fine; and alpha-appended hex only
// approximates a tint -- it doesn't actually blend toward the page's own
// neutral background the way a real color mix does. This computes both
// properly, once, from the real color.

const CANVAS = '#FAFAF9';
const INK = '#171412';

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

// WCAG relative luminance -- the standard formula, so the contrast-safe
// text choice below actually holds up rather than just "looking about right."
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function deriveStoreTheme(rawColor) {
  const color = /^#[0-9a-fA-F]{3,6}$/.test(rawColor || '') ? rawColor : '#0D9488';
  const luminance = relativeLuminance(hexToRgb(color));

  // Contrast ratio against white (luminance 1.0) vs black (luminance 0) --
  // whichever side has more headroom wins, so a CTA button stays legible
  // whether the vendor picked something pale or something near-black.
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const onAccent = contrastWithWhite >= contrastWithBlack ? '#FFFFFF' : INK;

  return {
    accent: color,
    onAccent,
    canvas: CANVAS,
    ink: INK,
    // Real blends toward the page's own neutral tokens via color-mix,
    // not an alpha hack -- holds for every vendor's accent without
    // per-color-family special-casing.
    tintFaint: `color-mix(in srgb, ${color} 6%, ${CANVAS})`,
    tint: `color-mix(in srgb, ${color} 10%, ${CANVAS})`,
    tintStrong: `color-mix(in srgb, ${color} 18%, ${CANVAS})`,
    border: `color-mix(in srgb, ${color} 22%, ${CANVAS})`,
    borderStrong: `color-mix(in srgb, ${color} 45%, ${CANVAS})`
  };
}
