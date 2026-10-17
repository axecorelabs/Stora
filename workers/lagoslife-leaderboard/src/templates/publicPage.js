// Static shell -- doesn't embed leaderboard data directly (that would tie
// this page's own cache TTL to the data's freshness). Instead it fetches
// GET /api/leaderboard client-side, which has its own, shorter cache
// lifetime (see src/cache.js). The only per-deploy variable baked in here
// is the public Turnstile site key, which is safe to expose.
//
// Layout: a top-3 podium, a ranked table below it, and the submission
// form lives in a modal (triggered by a button) rather than taking up
// permanent space in the page flow -- that's what gives the table room.
// Icons are small hand-authored inline SVGs (trophy, camera, plus, close)
// -- no icon library/build step available in a plain Worker page, so each
// one is kept deliberately simple rather than reproducing a complex
// external icon set's path data from memory.
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../assets.js';

function trophySvg(size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"/><path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>`;
}
const ICON_TROPHY = trophySvg(22);
const ICON_TROPHY_SM = trophySvg(20);
const ICON_TROPHY_LG = trophySvg(36);
const ICON_TROPHY_EMPTY = trophySvg(30);
function userSvg(size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>`;
}
const ICON_USER = userSvg(20);
const ICON_USER_LG = userSvg(38);
const ICON_CAMERA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
// Real brand marks, not hand-drawn stand-ins -- exact path data pulled
// from Simple Icons (simpleicons.org, CC0-licensed, the standard source
// for verified brand SVG paths), not reconstructed from memory. Each is a
// single filled path with fill="currentColor" so it inherits white on the
// solid dark badge and a muted tone on the dashed "unset" badge, same as
// every other icon on this page.
const ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>';
const ICON_TIKTOK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>';
const ICON_SNAPCHAT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg>';
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
const ICON_USERS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const ICON_ARROW_RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
const ICON_ARROW_LEFT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
// Real sourced icon (Lucide "chevron-down", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static) -- the "more games coming soon"
// collapsible toggle.
const ICON_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const ICON_MEGAPHONE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
// Real sourced icon (Lucide "bell-off", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static), used for the "no announcements
// yet" empty state -- same sourcing convention as the cloud popover icon.
const ICON_BELL_OFF = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/></svg>';
// Real sourced icon (Tabler Icons "cloud" filled, MIT-licensed, pulled
// via cdn.jsdelivr.net/npm/@tabler/icons -- not reconstructed from
// memory, same convention as the Instagram/TikTok/X marks elsewhere in
// this file). viewBox is cropped to the path's own drawn bounds
// (x:1-23, y:4-19, found by sampling its cubic bezier segments) rather
// than the icon's full 24x24 box, so there's no wasted blank margin
// when this is enlarged. The .announcements-popover-safe CSS box's
// percentages were computed by scanning that same sampled outline for
// the widest fully-inside rectangle across rows y=11-17, not guessed --
// they're tied to this exact path.
const ICON_CLOUD_BADGE = '<svg viewBox="1 4 22 15" fill="#fff"><path d="M10.04 4.305c2.195 -.667 4.615 -.224 6.36 1.176c1.386 1.108 2.188 2.686 2.252 4.34l.003 .212l.091 .003c2.3 .107 4.143 1.961 4.25 4.27l.004 .211c0 2.407 -1.885 4.372 -4.255 4.482l-.21 .005h-11.878l-.222 -.008c-2.94 -.11 -5.317 -2.399 -5.43 -5.263l-.005 -.216c0 -2.747 2.08 -5.01 4.784 -5.417l.114 -.016l.07 -.181c.663 -1.62 2.056 -2.906 3.829 -3.518l.244 -.08z"/></svg>';

// Canonical origin for every absolute URL in this page's OG/Twitter
// social-preview tags -- picked deliberately (not derived from the
// request) since this page is cached once and shared across every
// domain pointed at this Worker (lagoslife.stora.com.ng,
// lagoslifegames.com.ng, lagoslifeforbes.com.ng); a request-derived URL
// baked into a cached response would show whichever domain happened to
// populate that cache entry first, regardless of which domain a given
// visitor actually shared. Open Graph images specifically need a real
// absolute URL -- social crawlers don't reliably fetch a relative one.
const CANONICAL_ORIGIN = 'https://lagoslifeforbes.com.ng';
const OG_DESCRIPTION = "Are you the best in Lagos Life? Prove it. Submit your balance and see where you rank.";

function formatNairaLabel(kobo) {
  const naira = Math.round(Number(kobo || 0) / 100);
  return '₦' + naira.toLocaleString('en-NG');
}

export function renderPublicPage(env) {
  const siteKey = env.TURNSTILE_SITE_KEY || '';
  const ogImageUrl = `${CANONICAL_ORIGIN}/og-image.jpg`;
  const adPricePremiumDayLabel = formatNairaLabel(env.AD_PRICE_PREMIUM_DAY_KOBO);
  const adPricePremiumWeekLabel = formatNairaLabel(env.AD_PRICE_PREMIUM_WEEK_KOBO);
  const adPricePremiumMonthLabel = formatNairaLabel(env.AD_PRICE_PREMIUM_MONTH_KOBO);
  const adPriceStandardDayLabel = formatNairaLabel(env.AD_PRICE_STANDARD_DAY_KOBO);
  const adPriceStandardWeekLabel = formatNairaLabel(env.AD_PRICE_STANDARD_WEEK_KOBO);
  const adPriceStandardMonthLabel = formatNairaLabel(env.AD_PRICE_STANDARD_MONTH_KOBO);
  const adPriceCampaignBannerLabel = formatNairaLabel(env.AD_PRICE_CAMPAIGN_BANNER_KOBO);
  const socialUnlockPerDayKobo = Number(env.SOCIAL_UNLOCK_PRICE_PER_DAY_KOBO || 0);
  const socialUnlockPerDayLabel = formatNairaLabel(socialUnlockPerDayKobo);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lagos Life Forbes</title>
<meta name="description" content="${OG_DESCRIPTION}">
<link rel="icon" href="/og-image.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="/og-image.jpg">
<meta property="og:type" content="website">
<meta property="og:title" content="Lagos Life Forbes">
<meta property="og:description" content="${OG_DESCRIPTION}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Lagos Life Forbes">
<meta name="twitter:description" content="${OG_DESCRIPTION}">
<meta name="twitter:image" content="${ogImageUrl}">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>
  :root {
    --ink: #0b3321;
    --ink-soft: #0f4530;
    --gold: #f4c542;
    --gold-deep: #c8962c;
    --silver: #9fb3a6;
    --bronze: #c3804a;
    --bg: #ffffff;
    --surface: #f6f8f5;
    --border: #e4ebe3;
    --field-bg: #eef2ec;
    --text: #13241a;
    --muted: #6b7d72;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
  }
  .wrap { max-width: 480px; margin: 0 auto; padding: 78px 16px 110px; }
  /* Fixed so the announcements bell (and its popover, anchored to it)
     stays put at a constant spot on screen while the page scrolls,
     instead of travelling away with the rest of the header content.
     left/right:0 lets the bar span the full viewport edge-to-edge with
     a solid background (since position:fixed escapes .wrap's own
     max-width), while its own max-width+margin:auto keeps the actual
     trophy/title/bell content aligned with .wrap's column underneath.
     .wrap's top padding above was increased to match this bar's
     rendered height so scrolled content starts right below it instead
     of being hidden underneath. */
  header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 30;
    max-width: 480px; margin: 0 auto; background: var(--bg);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 16px; border-bottom: 1px solid var(--border);
  }
  header .icon-trophy { color: var(--gold-deep); flex-shrink: 0; }
  header h1 { font-size: 1.4rem; margin: 0; color: var(--text); letter-spacing: -0.01em; }
  .subtitle { text-align: center; color: var(--muted); margin: 0; font-size: 0.88rem; }

  /* -- Header announcements button + popover -- */
  .announcements-btn {
    /* right:0 here would align with header's own PADDING BOX edge --
       since header is position:fixed and spans the full viewport, that
       edge IS the viewport edge, so right:0 would ignore header's own
       16px padding entirely and sit flush against the screen edge.
       Matching that 16px explicitly keeps the real gutter. */
    position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
    background: var(--surface); border: 1px solid var(--border); border-radius: 50%;
    width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
    color: var(--ink); cursor: pointer; flex-shrink: 0;
  }
  .announcements-badge {
    position: absolute; top: -2px; right: -2px; width: 10px; height: 10px;
    border-radius: 50%; background: var(--gold-deep); border: 2px solid var(--bg);
  }
  .announcements-badge[hidden] { display: none; }
  /* The message lives INSIDE the cloud glyph itself. ICON_CLOUD_BADGE's
     viewBox ("1 4 22 15") is the real Tabler filled-cloud path's own
     drawn bounds, found by sampling its cubic bezier segments (not
     guessed). The safe-zone percentages below are the widest rectangle
     that stayed fully inside that sampled outline across rows y=11-17
     (original, uncropped path coordinates) -- max-of-row-mins=2.26,
     min-of-row-maxes=21.46 -- converted to percentages of the cropped
     22x15 box: left=(2.26-1)/22, right=100-(21.46-1)/22,
     top=(11-4)/15, bottom=100-(17-4)/15. */
  .announcements-popover {
    /* Same containing-block gotcha as the button above -- right must
       stay positive (and smaller than the button's 16px, so it still
       reads as attached to the button directly above it) rather than
       negative, or it runs past the screen's right edge. */
    position: absolute; top: calc(100% + 6px); right: 8px;
    width: min(190px, 68vw); aspect-ratio: 22 / 15; z-index: 40;
  }
  .announcements-popover[hidden] { display: none; }
  .announcements-popover-cloud {
    position: absolute; inset: 0; width: 100%; height: 100%;
    filter: drop-shadow(0 8px 16px rgba(11,51,33,0.28));
  }
  .announcements-popover-safe {
    position: absolute; left: 5.7%; right: 7%; top: 46.7%; bottom: 13.3%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 0 4px;
    /* Backstop against an unusually long title/body still spilling
       past this box's own edges (the body already line-clamps to 2
       lines, but hidden here too in case that ever isn't enough) --
       clipped-but-contained beats text floating outside the cloud. */
    overflow: hidden;
  }
  .announcements-popover-close {
    position: absolute; top: -2px; right: 0; width: 15px; height: 15px; border-radius: 50%;
    background: var(--surface); border: none; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .announcements-popover-close svg { width: 7px; height: 7px; }
  .announcements-popover-title {
    font-weight: 800; font-size: 0.66rem; color: var(--text); margin-bottom: 1px;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .announcements-popover-body {
    font-size: 0.6rem; color: var(--text); margin: 0; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .announcements-popover-nudge { cursor: pointer; }
  .announcements-popover-footer {
    display: flex; align-items: center; gap: 2px; margin-top: 3px;
    font-size: 0.56rem; font-weight: 700; color: var(--gold-deep); text-decoration: none;
    background: none; border: none; cursor: pointer; font-family: inherit; padding: 0;
  }
  .announcements-popover-footer svg { width: 8px; height: 8px; }
  .header-divider { border: none; border-top: 1px solid var(--border); margin: 18px 0 0; }
  .visitor-stats-row { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin-top: 14px; }
  .visitor-stat { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; color: var(--muted); }
  /* Author display above would otherwise beat the browser's own
     [hidden] rule (origin beats specificity/order) -- without this,
     hiding a stat below its reveal threshold would silently do nothing. */
  .visitor-stat[hidden] { display: none; }
  .visitor-stat-icon { display: flex; color: var(--gold-deep); flex-shrink: 0; }
  .visitor-stat strong { color: var(--text); font-weight: 800; font-variant-numeric: tabular-nums; }

  .stora-promo-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: linear-gradient(135deg, var(--ink-soft), var(--ink));
    color: #fff; text-decoration: none; border-radius: 16px; padding: 16px 18px;
    margin-bottom: 20px;
  }
  .stora-promo-text { display: flex; flex-direction: column; gap: 2px; }
  .stora-promo-title { font-weight: 800; color: var(--gold); font-size: 0.92rem; }
  .stora-promo-sub { font-size: 0.76rem; color: rgba(255,255,255,0.72); }
  .stora-promo-arrow { flex-shrink: 0; color: var(--gold); }

  /* -- "More games coming soon" collapsible teaser -- */
  .coming-soon-section { margin-bottom: 20px; }
  .coming-soon-toggle {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 13px 16px; cursor: pointer; font-family: inherit;
  }
  .coming-soon-toggle-text { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.88rem; color: var(--text); }
  .coming-soon-chevron { display: flex; color: var(--muted); transition: transform 0.2s ease; flex-shrink: 0; }
  .coming-soon-toggle[aria-expanded="true"] .coming-soon-chevron { transform: rotate(180deg); }
  .coming-soon-toggle[aria-expanded="true"] { border-radius: 14px 14px 0 0; border-bottom-color: transparent; }
  .coming-soon-grid {
    display: grid; grid-template-columns: 1fr; gap: 10px;
    background: var(--surface); border: 1px solid var(--border); border-top: none;
    border-radius: 0 0 14px 14px; padding: 4px 14px 14px;
  }
  @media (min-width: 560px) {
    .coming-soon-grid { grid-template-columns: 1fr 1fr; }
  }
  .coming-soon-grid[hidden] { display: none; }
  .coming-soon-card { background: #fff; border: 1px dashed var(--border); border-radius: 12px; padding: 12px 14px; }
  .coming-soon-tag {
    display: inline-block; background: var(--field-bg); color: var(--gold-deep); font-size: 0.64rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; margin-bottom: 7px;
  }
  .coming-soon-title { font-weight: 800; font-size: 0.86rem; color: var(--text); margin-bottom: 3px; }
  .coming-soon-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.4; margin: 0; }
  /* Ranking's own top spacing comes from .disclaimer's margin -- the
     Profile view has nothing playing that role, so without this its
     content sits flush against the divider above. */
  #view-profile { margin-top: 16px; }
  #view-announcements { margin-top: 16px; }
  .back-link {
    display: inline-flex; align-items: center; gap: 6px; color: var(--muted);
    font-size: 0.85rem; font-weight: 700; background: none; border: none;
    cursor: pointer; padding: 0; margin-bottom: 18px;
  }
  .announcement-list { display: flex; flex-direction: column; gap: 14px; }
  .announcement-card {
    background: #fff; border: 1px solid var(--border); border-radius: 16px;
    padding: 16px 18px; box-shadow: 0 2px 14px rgba(11,51,33,0.05);
  }
  .announcement-card-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%; background: var(--field-bg);
    color: var(--gold-deep); flex-shrink: 0;
  }
  .announcement-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .announcement-card-title { font-size: 1rem; font-weight: 800; letter-spacing: -0.005em; }
  .announcement-card-date { font-size: 0.74rem; color: var(--muted); margin-top: 1px; }
  .announcement-card-body { font-size: 0.9rem; line-height: 1.55; color: var(--text); margin: 0; white-space: pre-wrap; }
  .disclaimer {
    font-size: 0.74rem;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 12px;
    margin: 16px 0;
  }

  /* -- Campaign mode -- */
  .campaign-banner {
    text-align: center; background: var(--field-bg); border: 1px solid var(--gold-deep);
    border-radius: 14px; padding: 12px 14px; margin-bottom: 16px;
    display: flex; flex-direction: column; align-items: center;
  }
  /* Author display always beats the browser's own [hidden] UA rule --
     without this, toggling the hidden attribute via JS (or the server's
     own default-hidden markup) silently does nothing and an empty
     bordered box sits there with no campaign to show. */
  .campaign-banner[hidden] { display: none; }
  .campaign-banner-title { font-weight: 800; font-size: 0.92rem; color: var(--text); }
  .campaign-banner-reward {
    display: inline-flex; align-items: center; justify-content: center;
    margin-top: 8px; padding: 8px 12px; border-radius: 999px;
    background: rgba(244,197,66,0.2); border: 1px solid rgba(200,150,44,0.38);
    color: var(--gold-deep); font-size: 0.92rem; font-weight: 900;
    letter-spacing: 0.01em;
  }
  .campaign-banner-sponsor {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--gold-deep);
    text-decoration: none; font-size: 0.72rem; color: var(--muted); font-weight: 600;
  }
  .campaign-banner-countdown {
    margin-top: 8px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    text-align: center;
  }
  .campaign-banner-countdown-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .campaign-banner-countdown-value {
    display: block;
    margin-top: 2px;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .campaign-banner-sponsor img { width: 26px; height: 26px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); }
  /* The unconditional display above would otherwise beat the browser's
     own [hidden] rule (author styles always win over the UA stylesheet,
     regardless of specificity/order) -- without this, toggling the
     hidden attribute via JS would silently do nothing and an empty
     slot would stay visible. */
  .campaign-banner-sponsor[hidden] { display: none; }
  /* Shown instead of .campaign-banner during the waiting period between
     campaigns -- the board is frozen on the last one's results (see
     handleLeaderboard), this just says so instead of looking identical
     to a real live campaign. */
  .frozen-results-banner {
    text-align: center; background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 10px 14px; margin-bottom: 16px;
  }
  .frozen-results-banner[hidden] { display: none; }
  .frozen-results-title { font-weight: 700; font-size: 0.82rem; color: var(--muted); }
  .frozen-results-title strong { color: var(--text); }
  .frozen-results-link { font-size: 0.76rem; color: var(--gold-deep); font-weight: 700; text-decoration: none; margin-top: 2px; display: inline-block; }
  .campaign-gate { text-align: center; padding: 14px 4px 4px; }
  .campaign-gate-countdown {
    font-size: 0.95rem; font-weight: 800; color: var(--gold-deep); margin: 6px 0 0;
    font-variant-numeric: tabular-nums;
  }

  .cta-row { display: flex; justify-content: center; margin-bottom: 18px; }
  .cta-row[hidden] { display: none; }
  .cta-button {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--gold); color: var(--text); border: none;
    font-weight: 700; font-size: 0.88rem;
    padding: 10px 18px; border-radius: 999px; cursor: pointer;
  }

  /* -- Leaderboard card: podium + table, one cohesive panel matching the
     profile card's treatment (white, bordered, soft shadow) rather than
     floating directly on the page background. -- */
  .board-panel {
    background: #fff; border: 1px solid var(--border); border-radius: 20px;
    padding: 22px 14px 16px; box-shadow: 0 2px 14px rgba(11,51,33,0.05);
    margin-bottom: 20px;
  }
  .podium { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-bottom: 26px; }
  /* Author display above would otherwise beat the browser's own
     [hidden] rule (origin beats specificity/order) -- harmless while
     empty (nothing to see either way), but worth closing so a future
     bug here doesn't silently ship the same way .table-head's did. */
  .podium[hidden] { display: none; }
  .podium-slot { display: flex; flex-direction: column; align-items: center; width: 32%; }
  .avatar-wrap { position: relative; margin-bottom: 10px; }
  /* Same gold-ring language as the profile avatar, medal-colored per
     place -- border + white padding gap around the avatar's own white
     border, so the podium visually ties back to the profile card. */
  .podium-avatar-ring { display: inline-flex; border-radius: 50%; padding: 3px; background: #fff; }
  .place-1 .podium-avatar-ring { border: 3px solid var(--gold); }
  .place-2 .podium-avatar-ring { border: 3px solid var(--silver); }
  .place-3 .podium-avatar-ring { border: 3px solid var(--bronze); }
  .avatar {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: #fff; font-size: 1rem;
    border: 3px solid #fff; box-shadow: 0 2px 10px rgba(11,51,33,0.18);
  }
  .podium-slot.place-1 .avatar { width: 76px; height: 76px; font-size: 1.3rem; }
  .rank-badge {
    position: absolute; bottom: 2px; right: -2px;
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 0.72rem; color: #fff;
    border: 2px solid #fff; box-shadow: 0 1px 3px rgba(11,51,33,0.2);
  }
  .place-1 .rank-badge { background: var(--gold-deep); }
  .place-2 .rank-badge { background: var(--silver); }
  .place-3 .rank-badge { background: var(--bronze); }
  .podium-name {
    font-weight: 700; font-size: 0.85rem; color: var(--text);
    max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* Paid perk (see renderSocialUnlockStatus) -- only ever rendered when
     the entry's own account currently has an active unlock; the data
     itself is withheld server-side otherwise (getApprovedLeaderboard),
     so there's nothing to gate again on the client here. */
  .entry-social-row { display: flex; justify-content: center; gap: 5px; margin-top: 5px; flex-shrink: 0; }
  .entry-social-link {
    width: 18px; height: 18px; border-radius: 50%; background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .entry-social-link svg { width: 10px; height: 10px; }
  .rest-list .entry-social-row { margin: 0; }
  .podium-balance {
    margin-top: 6px; background: #fff; color: var(--gold-deep); border: 1px solid var(--border);
    font-weight: 700; font-size: 0.74rem; padding: 3px 9px; border-radius: 999px;
    display: flex; align-items: center; gap: 3px; white-space: nowrap;
    /* Reported balances can run up to 999,999,999,999,999 (the DB's own
       max) -- min-width:0 lets this pill actually shrink within its
       32%-wide podium column instead of forcing it wider and
       overlapping the neighboring place's card; .balance-amount below
       is what actually truncates the number once it does. */
    max-width: 100%; min-width: 0;
  }
  /* Shared by every balance display (podium/list/profile/history) --
     shows the short form (1.2M, 5B, 1000T, see formatBalanceAbbrev);
     the overflow/ellipsis handling here is now just a defensive
     backstop (abbreviated text is always short) rather than the
     primary fix. Tappable -- see #balance-tooltip below for the exact
     full amount on click. */
  .balance-amount {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
    cursor: pointer; text-decoration: underline; text-decoration-style: dotted;
    text-decoration-color: currentColor; text-underline-offset: 2px;
  }
  /* Shared single tooltip, repositioned to whichever .balance-amount was
     tapped, instead of one tooltip element per balance on the page. */
  .balance-tooltip {
    position: fixed; z-index: 60; background: var(--ink); color: #fff;
    font-size: 0.74rem; font-weight: 700; padding: 6px 11px; border-radius: 8px;
    white-space: nowrap; pointer-events: none; transform: translate(-50%, -100%);
    box-shadow: 0 6px 16px rgba(0,0,0,0.3); font-variant-numeric: tabular-nums;
  }
  .balance-tooltip[hidden] { display: none; }
  .balance-tooltip::after {
    content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    border: 5px solid transparent; border-top-color: var(--ink);
  }
  .balance-tooltip.tooltip-below { transform: translate(-50%, 10px); }
  .balance-tooltip.tooltip-below::after {
    top: auto; bottom: 100%; border-top-color: transparent; border-bottom-color: var(--ink);
  }
  .pedestal {
    width: 100%; margin-top: 10px; border-radius: 10px 10px 0 0;
    background: linear-gradient(180deg, var(--field-bg), var(--border));
    display: flex; align-items: flex-start; justify-content: center; padding-top: 6px;
  }
  .pedestal .num { color: rgba(0,0,0,0.16); font-weight: 800; font-size: 1.8rem; }
  .place-1 .pedestal { height: 74px; }
  .place-2 .pedestal { height: 54px; }
  .place-3 .pedestal { height: 40px; }

  /* -- Ranked table, ranks 4+ -- */
  /* Mirrors the rest-list row's own flex structure (rank width, avatar
     width, gaps) exactly, so the header labels land precisely over their
     column instead of an approximated padding offset. */
  .table-head {
    display: flex; align-items: center; gap: 10px; padding: 0 14px 8px;
    font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--muted); font-weight: 700;
  }
  /* Same [hidden]-vs-author-display fix as elsewhere in this file --
     without this, the "hidden" attribute toggled from JS does nothing
     and the header shows up even with zero entries. */
  .table-head[hidden] { display: none; }
  .table-head .col-rank { width: 20px; text-align: center; flex-shrink: 0; }
  .table-head .col-avatar { width: 32px; flex-shrink: 0; }
  .table-head .col-player { flex: 1; }
  .rest-list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .rest-list li {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px; border-bottom: 1px solid var(--border);
  }
  .rest-list li:last-child { border-bottom: none; }
  .rest-rank { width: 20px; text-align: center; font-weight: 700; color: var(--muted); font-size: 0.85rem; }
  .rest-avatar {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: #fff; font-size: 0.72rem;
  }
  .avatar, .rest-avatar, .profile-avatar-lg { object-fit: cover; }
  .rest-name { flex: 1; min-width: 0; font-weight: 600; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rest-balance { font-weight: 700; font-size: 0.82rem; color: var(--gold-deep); display: flex; align-items: center; gap: 3px; white-space: nowrap; flex-shrink: 0; min-width: 0; max-width: 45%; }
  .coin {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; background: var(--gold-deep);
    color: #fff; font-size: 0.62rem; font-weight: 800; flex-shrink: 0;
  }

  .empty-state, .loading-state { color: var(--muted); font-size: 0.88rem; text-align: center; padding: 10px 0; }
  .board-empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 30px 16px 22px; text-align: center;
  }
  .board-empty-state[hidden] { display: none; }
  .board-empty-icon {
    display: flex; align-items: center; justify-content: center;
    width: 60px; height: 60px; border-radius: 50%; background: var(--surface);
    color: var(--muted);
  }
  .board-empty-text { color: var(--muted); font-size: 0.86rem; margin: 0; }

  /* -- Profile view -- */
  .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; text-align: center; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
  .status-pending { background: #fdf3d8; color: #8a6d1d; }
  .status-approved { background: #e3f3e7; color: var(--ink-soft); }
  .status-rejected { background: #fbe4e1; color: #b3261e; }
  /* Used by the logged-out anonymous-submission fallback card only (see
     entryStatusBlock/renderAnonymousStatus) -- the logged-in profile card
     shows balance/rank via .profile-stats-row instead. */
  .profile-balance {
    font-size: 1.3rem; font-weight: 800; color: var(--ink); display: flex; align-items: center;
    justify-content: center; gap: 5px; margin: 10px 0 6px; max-width: 100%;
  }
  .profile-rank { font-size: 0.85rem; font-weight: 700; color: var(--gold-deep); margin-bottom: 10px; }
  .profile-rank-locked { color: var(--muted); font-weight: 600; }
  .profile-note { font-size: 0.8rem; color: var(--muted); margin: 10px 0 0; }
  .profile-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .profile-actions .cta-button { width: 100%; justify-content: center; }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; justify-content: center;
    background: #fff; color: var(--ink); border: 1px solid var(--border);
    font-weight: 700; font-size: 0.85rem; padding: 10px 16px; border-radius: 999px; cursor: pointer;
  }
  .btn-link {
    background: none; border: none; color: var(--muted); font-size: 0.8rem;
    text-decoration: underline; cursor: pointer; padding: 4px;
  }

  /* -- Profile card (logged-in): avatar ring, rank pill, stats, socials -- */
  .profile-avatar-block { position: relative; width: 104px; margin: 0 auto 22px; }
  .avatar-camera-badge {
    position: absolute; right: -2px; bottom: 10px;
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--ink); color: #fff; border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; padding: 0;
  }
  .profile-avatar-ring {
    width: 104px; height: 104px; border-radius: 50%; border: 3px solid var(--gold);
    padding: 4px; display: flex; align-items: center; justify-content: center;
    background: #fff;
  }
  .profile-avatar-lg { width: 94px; height: 94px; font-size: 1.8rem; border: 3px solid #fff; }
  .profile-rank-pill {
    position: absolute; left: 50%; bottom: -12px; transform: translateX(-50%);
    background: var(--gold); color: var(--ink); font-size: 0.66rem; font-weight: 800;
    padding: 4px 12px; border-radius: 999px; white-space: nowrap;
    box-shadow: 0 2px 6px rgba(11,51,33,0.18);
  }
  .profile-rank-pill.unranked { background: #fff; color: var(--muted); border: 1px solid var(--border); }
  .profile-name-row { display: flex; align-items: center; justify-content: center; gap: 6px; }
  .profile-name-text { font-weight: 800; font-size: 1.15rem; color: var(--text); }
  .verified-badge { color: var(--ink-soft); flex-shrink: 0; }
  .profile-handle-text { color: var(--muted); font-size: 0.85rem; margin: 2px 0 14px; }
  .profile-social-row { display: flex; justify-content: center; gap: 10px; margin-bottom: 18px; }
  .social-icon-btn {
    width: 36px; height: 36px; border-radius: 50%; background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;
  }
  /* Not-yet-added social link -- a dashed, muted "add" affordance rather
     than a solid working-looking button, and rather than hiding the slot
     entirely (which is how people never discover it's an option). */
  .social-icon-btn.unset { background: #fff; color: var(--muted); border: 1.5px dashed var(--border); }
  .social-unlock-banner {
    display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
    margin: -8px 0 18px; padding: 8px 12px; border-radius: 999px; border: 1px dashed var(--gold-deep);
    background: var(--field-bg); color: var(--gold-deep); font-size: 0.76rem; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }
  .social-unlock-banner.active {
    border-style: solid; border-color: var(--ink-soft); background: #e3f3e7; color: var(--ink-soft);
  }
  .social-unlock-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-soft); flex-shrink: 0; }
  /* Shown once, right after a successful balance submission -- the
     highest-intent moment to pitch this, since they just engaged with
     the core action instead of discovering the perk by accident later
     buried in the profile tab. */
  .submit-success-nudge {
    margin-top: 16px; padding: 14px 16px; border-radius: 14px;
    border: 1px dashed var(--gold-deep); background: var(--field-bg);
  }
  .submit-success-state {
    margin-top: 4px;
  }
  .submit-success-message {
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(15,69,48,0.22);
    background: #ecf6ef;
    color: var(--ink-soft);
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.45;
  }
  .submit-success-nudge-title { font-weight: 800; font-size: 0.86rem; color: var(--text); margin: 0 0 4px; }
  .submit-success-nudge-body { font-size: 0.8rem; color: var(--muted); line-height: 1.45; margin: 0 0 12px; }
  .submit-success-nudge .btn-secondary { width: 100%; justify-content: center; }
  .profile-stats-row {
    display: flex; border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; margin-bottom: 18px; background: #fff;
  }
  .profile-stat { flex: 1; text-align: center; padding: 12px 4px; border-right: 1px solid var(--border); }
  .profile-stat:last-child { border-right: none; }
  .profile-stat .stat-value {
    display: block; font-weight: 800; font-size: 0.98rem; color: var(--ink);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .profile-stat .stat-label { display: block; font-size: 0.64rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }
  .profile-actions-row { display: flex; align-items: center; gap: 8px; }
  .profile-actions-row .btn-secondary, .profile-actions-row .cta-button { flex: 1; justify-content: center; }
  .profile-actions-row .cta-button { white-space: nowrap; font-size: 0.82rem; }
  .profile-actions-row .cta-button.profile-submit-disabled {
    background: var(--surface);
    color: var(--muted);
    border: 1px solid var(--border);
    cursor: not-allowed;
  }
  .profile-actions-row .icon-button { flex-shrink: 0; }

  /* -- Submission history ("Recent submissions") -- */
  .profile-history { margin-top: 22px; }
  .profile-history h3 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 10px; }
  .history-list { list-style: none; margin: 0; padding: 0; }
  .history-item {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 11px 14px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; margin-bottom: 8px;
  }
  .history-item .history-balance { font-weight: 700; font-size: 0.88rem; color: var(--ink); display: flex; align-items: center; gap: 4px; min-width: 0; }
  .history-item .history-date { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }

  /* -- Auth modal (log in / sign up) -- */
  #auth-status { font-size: 0.82rem; margin-top: 8px; min-height: 1.1em; }
  #auth-status.error { color: #b3261e; }
  #auth-status.success { color: var(--ink-soft); }

  /* -- Logged-out Profile tab placeholder + anonymous-entry fallback -- */
  .profile-placeholder-icon { background: var(--border); color: var(--muted); }
  .anon-status-divider { font-size: 0.74rem; color: var(--muted); text-align: center; margin: 18px 0 10px; }

  /* -- Floating bottom tab bar -- */
  .tab-bar {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(16px + env(safe-area-inset-bottom));
    width: calc(100% - 32px); max-width: 448px;
    background: #fff; border: 1px solid var(--border); border-radius: 999px;
    box-shadow: 0 10px 30px rgba(11,51,33,0.18);
    display: flex; align-items: center; gap: 4px; padding: 6px;
    z-index: 40;
  }
  /* flex-basis 0 + grow ratios (6 : 2 : 2) split the bar precisely into
     60% / 20% / 20% regardless of the row's gap/padding -- a percentage
     flex-basis would need manual gap compensation to land exactly. */
  .tab-btn {
    flex: 2 1 0%; display: flex; align-items: center; justify-content: center;
    background: none; border: none; padding: 12px 4px; border-radius: 999px;
    color: var(--muted); cursor: pointer;
  }
  .tab-btn svg { flex-shrink: 0; }
  .tab-btn.active { background: var(--ink); color: #fff; }
  .rank-chip {
    flex: 6 1 0%; display: flex; align-items: center; justify-content: center; gap: 6px;
    background: var(--gold); color: var(--text); border-radius: 999px;
    padding: 10px 14px; font-size: 0.72rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .rank-chip strong { font-size: 1rem; font-weight: 800; text-transform: none; letter-spacing: 0; }

  /* -- Submission modal -- */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(11,51,33,0.5);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 50;
  }
  .modal-overlay[hidden] { display: none; }
  .modal-card {
    background: #fff; width: 100%; max-width: 480px;
    border-radius: 20px 20px 0 0; padding: 20px;
    max-height: 88vh; overflow-y: auto;
    box-shadow: 0 -8px 30px rgba(0,0,0,0.25);
  }
  @media (min-width: 560px) {
    .modal-overlay { align-items: center; padding: 16px; }
    .modal-card { border-radius: 20px; }
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .modal-header h2 { margin: 0; font-size: 1.05rem; color: var(--ink); }
  .icon-button {
    background: var(--surface); border: 1px solid var(--border); border-radius: 50%;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--ink); flex-shrink: 0;
  }

  /* -- First-visit welcome modal -- */
  .welcome-modal-card { position: relative; text-align: center; padding: 34px 26px 26px; }
  .welcome-modal-close { position: absolute; top: 14px; right: 14px; }
  .welcome-modal-icon {
    width: 76px; height: 76px; border-radius: 50%; margin: 0 auto 18px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%);
    color: var(--ink); box-shadow: 0 10px 24px rgba(200,150,44,0.4);
  }
  .welcome-modal-title { font-size: 1.32rem; font-weight: 800; color: var(--ink); margin: 0 0 6px; line-height: 1.28; }
  .welcome-modal-sub { font-size: 1.02rem; font-weight: 800; color: var(--gold-deep); margin: 0 0 24px; }
  .welcome-modal-dismiss { display: block; margin: 14px auto 0; }
  .sponsor-spotlight-eyebrow { font-size: 0.78rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 4px 0 16px; }
  .sponsor-spotlight-link { display: block; margin: 0 auto 18px; }
  .sponsor-spotlight-image {
    display: block; margin: 0 auto; max-width: 220px; max-height: 110px; width: auto; height: auto;
    object-fit: contain; border-radius: 10px;
  }
  /* Not scoped to a form element -- the auth modal's fields sit directly
     in the modal card with no form wrapper (its buttons are click-handled,
     not submit-handled), so "form .field" would never match there. */
  .field { margin-bottom: 14px; }
  .form-section-note { font-size: 0.78rem; color: var(--muted); margin: 0 0 12px; }
  label { display: flex; align-items: center; gap: 5px; font-size: 0.86rem; margin-bottom: 7px; color: var(--ink); font-weight: 700; }
  /* Pill-shaped, flat light-gray fill, no border -- matches Lagos Life's
     own signup form (fully rounded inputs, borderless, resting on a
     white card). */
  input[type="text"], input[type="number"], input[type="email"], input[type="password"] {
    width: 100%;
    padding: 13px 18px;
    border-radius: 999px;
    border: none;
    background: var(--field-bg);
    color: var(--text);
    /* 16px, not a smaller rem value -- iOS Safari auto-zooms the page on
       focus for any text input under 16px, which read as an unwanted
       "zoom in" on every tap. 16px is the threshold where it stops. */
    font-size: 16px;
  }
  input[type="text"]:focus, input[type="number"]:focus, input[type="email"]:focus, input[type="password"]:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
  input::placeholder { color: var(--muted); opacity: 1; }
  .password-field-wrap { position: relative; }
  .password-field-wrap input[type="password"], .password-field-wrap input[type="text"] { padding-right: 46px; }
  .password-toggle {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--muted); cursor: pointer;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  }
  /* The native spinner arrows are square-cornered and look wrong against
     a fully rounded pill input. */
  input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
  input[type="file"] { color: var(--muted); font-size: 0.82rem; }
  button[type="submit"] {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    border: none;
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    margin-top: 6px;
  }
  button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
  .cf-turnstile { margin: 10px 0; }
  #submit-status, #profile-edit-status, #advertise-status { font-size: 0.85rem; margin-top: 10px; }
  #submit-status.error, #profile-edit-status.error, #advertise-status.error { color: #b3261e; }
  #submit-status.success, #profile-edit-status.success, #advertise-status.success { color: var(--ink-soft); }
  footer { text-align: center; margin-top: 22px; }
  .footer-note { color: var(--muted); font-size: 0.76rem; margin: 0 0 10px; }

  /* -- Sponsored ad slot (inside the leaderboard card, between podium and
     the ranked table) -- */
  /* Always the first thing in the card -- same position whether the
     leaderboard below it is gated, empty, or fully shown, so it never
     looks like it's attached to whatever happens to render beneath it. */
  .sponsored-slot { display: block; position: relative; margin: 0 0 18px; border-radius: 14px; overflow: hidden; text-decoration: none; }
  /* Author display rules always beat the browser's own [hidden] rule
     (origin beats specificity/order) -- without this override, toggling
     .hidden via JS would silently do nothing and an empty slot (no ad
     currently running there) would stay visible as a blank box. */
  .sponsored-slot[hidden] { display: none; }
  .sponsored-slot img { width: 100%; height: auto; max-height: 120px; object-fit: cover; display: block; border: 1px solid var(--border); border-radius: 14px; }
  .sponsored-tag {
    position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.55); color: #fff;
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 3px 8px; border-radius: 999px;
  }

  /* -- Advertise modal -- */
  .package-picker { display: flex; gap: 8px; }
  .package-option {
    flex: 1; text-align: center; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--border);
    background: #fff; font-size: 0.78rem; font-weight: 700; color: var(--text); cursor: pointer; line-height: 1.5;
  }
  .package-option.selected { border-color: var(--gold-deep); background: var(--field-bg); color: var(--gold-deep); }
  .slot-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .slot-option {
    text-align: center; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--border);
    background: #fff; font-size: 0.78rem; font-weight: 700; color: var(--text); cursor: pointer;
  }
  .slot-option.selected { border-color: var(--gold-deep); background: var(--field-bg); color: var(--gold-deep); }
  .slot-option:disabled { opacity: 0.4; cursor: not-allowed; }
  .social-unlock-price { text-align: center; font-weight: 800; color: var(--gold-deep); font-size: 0.95rem; margin: 10px 0 2px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="icon-trophy">${ICON_TROPHY}</span>
    <h1>Lagos Life Forbes</h1>
    <button type="button" class="announcements-btn" id="announcements-btn" aria-label="Announcements">
      ${ICON_BELL}
      <span class="announcements-badge" id="announcements-badge" hidden></span>
    </button>
    <div class="announcements-popover" id="announcements-popover">
      <div class="announcements-popover-cloud" aria-hidden="true">${ICON_CLOUD_BADGE}</div>
      <div class="announcements-popover-safe">
        <button type="button" class="announcements-popover-close" id="announcements-popover-close" aria-label="Close">${ICON_CLOSE}</button>
        <div id="announcements-popover-message">
          <div class="announcements-popover-title">Loading&hellip;</div>
        </div>
        <button type="button" class="announcements-popover-footer" id="announcements-view-all-btn">View all ${ICON_ARROW_RIGHT}</button>
      </div>
    </div>
  </header>
  <p class="subtitle">Are you the best in Lagos Life? Prove it.</p>
  <hr class="header-divider">
  <div class="visitor-stats-row">
    <span class="visitor-stat" id="live-visitor-stat" hidden><span class="visitor-stat-icon">${ICON_EYE}</span> <strong id="live-visitor-count">--</strong> here now</span>
    <span class="visitor-stat" id="total-visitor-stat" hidden><span class="visitor-stat-icon">${ICON_USERS}</span> <strong id="total-visitor-count">--</strong> all-time</span>
  </div>

  <div id="view-ranking">
    <div class="campaign-banner" id="campaign-banner" hidden>
      <div class="campaign-banner-title" id="campaign-banner-title"></div>
      <div class="campaign-banner-reward" id="campaign-banner-reward"></div>
      <div class="campaign-banner-countdown" id="campaign-banner-countdown" hidden>
        <span class="campaign-banner-countdown-label">Campaign ends in</span>
        <span class="campaign-banner-countdown-value" id="campaign-banner-countdown-value">--</span>
      </div>
      <a class="campaign-banner-sponsor" id="sponsored-slot-campaign" href="#" target="_blank" rel="noopener noreferrer sponsored" hidden>
        <img id="sponsored-image-campaign" src="" alt="Sponsor">
        <span>Presented by our sponsor</span>
      </a>
    </div>

    <div class="frozen-results-banner" id="frozen-results-banner" hidden>
      <div class="frozen-results-title">Final results: <strong id="frozen-results-name"></strong></div>
      <a class="frozen-results-link" href="/campaigns">View past campaigns &amp; winners &rarr;</a>
    </div>

    <div class="cta-row" id="top-submit-row">
      <button type="button" class="cta-button" id="open-submit-modal">${ICON_PLUS} Submit your balance</button>
    </div>

    <section class="board-panel">
      <a class="sponsored-slot" id="sponsored-slot" href="#" target="_blank" rel="noopener noreferrer sponsored" hidden>
        <img id="sponsored-image" src="" alt="Sponsored">
        <span class="sponsored-tag">Sponsored</span>
      </a>
      <div class="campaign-gate" id="campaign-gate" hidden>
        <div id="campaign-gate-submit-state">
          <p class="empty-state" id="campaign-gate-text">Submit your balance to unlock this campaign's leaderboard.</p>
          <div class="cta-row" style="margin-bottom:0">
            <button type="button" class="cta-button" id="campaign-gate-submit-btn">${ICON_PLUS} Submit your balance</button>
          </div>
        </div>
        <div id="campaign-gate-reveal-state" hidden>
          <p class="empty-state" id="campaign-gate-reveal-message">You're entered! Sneak peek opens at <strong id="campaign-gate-reveal-time"></strong><span id="campaign-gate-close-fragment" hidden> and closes again at <strong id="campaign-gate-close-time"></strong></span>.</p>
          <p class="empty-state" id="campaign-gate-reveal-end-message" hidden>You're entered! Results stay completely hidden until this campaign ends<span id="campaign-gate-end-fragment" hidden> -- <strong id="campaign-gate-end-time"></strong></span>.</p>
          <p class="campaign-gate-countdown" id="campaign-gate-countdown"></p>
        </div>
      </div>
      <p class="loading-state" id="board-loading">Loading leaderboard&hellip;</p>
      <div class="podium" id="podium" hidden></div>
      <div class="table-head" id="table-head" hidden>
        <span class="col-rank">#</span>
        <span class="col-avatar"></span>
        <span class="col-player">Player</span>
        <span>Balance</span>
      </div>
      <div class="board-empty-state" id="board-empty" hidden>
        <span class="board-empty-icon">${ICON_TROPHY_EMPTY}</span>
        <p class="board-empty-text" id="board-empty-text"></p>
      </div>
      <ul class="rest-list" id="rest-list" hidden></ul>
    </section>

    <a class="sponsored-slot" id="sponsored-slot-bottom" href="#" target="_blank" rel="noopener noreferrer sponsored" hidden>
      <img id="sponsored-image-bottom" src="" alt="Sponsored">
      <span class="sponsored-tag">Sponsored</span>
    </a>

    <div class="coming-soon-section">
      <button type="button" class="coming-soon-toggle" id="coming-soon-toggle" aria-expanded="false" aria-controls="coming-soon-grid">
        <span class="coming-soon-toggle-text">${ICON_TROPHY_SM} More games coming soon</span>
        <span class="coming-soon-chevron">${ICON_CHEVRON_DOWN}</span>
      </button>
      <div class="coming-soon-grid" id="coming-soon-grid" hidden>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">\u{1faab} Poorest Player</div>
          <p class="coming-soon-desc">Dead broke and proud? Prove you're the realest struggler in Lagos Life.</p>
        </div>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">\u{1f393} Most Certified</div>
          <p class="coming-soon-desc">Stack the most in-game certifications and take the crown.</p>
        </div>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">⭐ Most Popular</div>
          <p class="coming-soon-desc">Biggest fanbase in Lagos Life -- flex your following.</p>
        </div>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">\u{1f4bc} Most Influential Businessperson</div>
          <p class="coming-soon-desc">Build the biggest business empire in the game.</p>
        </div>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">\u{1f48e} Biggest Flex</div>
          <p class="coming-soon-desc">Cars, mansion, garage -- show off your whole collection.</p>
        </div>
        <div class="coming-soon-card">
          <span class="coming-soon-tag">Coming soon</span>
          <div class="coming-soon-title">\u{1f3a4} Most Booked Musician</div>
          <p class="coming-soon-desc">Most gigs booked in-game. Prove you're the hottest act.</p>
        </div>
      </div>
    </div>

    <a class="stora-promo-banner" href="https://stora.com.ng" target="_blank" rel="noopener noreferrer">
      <span class="stora-promo-text">
        <span class="stora-promo-title">Hosted by Stora</span>
        <span class="stora-promo-sub">Discover real vendors &amp; shops on Nigeria's marketplace</span>
      </span>
      <span class="stora-promo-arrow">${ICON_ARROW_RIGHT}</span>
    </a>
  </div>

  <div id="view-profile" hidden>
    <a class="sponsored-slot" id="sponsored-slot-profile" href="#" target="_blank" rel="noopener noreferrer sponsored" hidden>
      <img id="sponsored-image-profile" src="" alt="Sponsored">
      <span class="sponsored-tag">Sponsored</span>
    </a>
    <div id="profile-content"></div>
  </div>

  <!-- Reachable from the header popover's "View all" link, not from the
       bottom tab bar -- it's a destination, not a primary section of
       the app the way Ranking/Profile are. -->
  <div id="view-announcements" hidden>
    <button type="button" class="back-link" id="announcements-back-link">${ICON_ARROW_LEFT} Back to the leaderboard</button>
    <div id="announcements-full-list">
      <p class="loading-state">Loading&hellip;</p>
    </div>
  </div>

  <footer id="page-footer">
    <p class="disclaimer">
      Fan-made leaderboard, not affiliated with Lagos Life's developers. Balances are
      self-reported and reviewed before they appear here -- treat it as entertainment,
      not a verified ranking. Play the game at <a href="https://lagoslife.app" target="_blank" rel="noopener noreferrer">lagoslife.app</a>.
    </p>
    <p class="footer-note">Entries are manually reviewed before publishing.</p>
    <button type="button" class="btn-secondary" id="open-advertise-modal">${ICON_MEGAPHONE} Advertise here</button>
  </footer>
</div>

<input type="file" id="avatar-quick-input" accept="image/png,image/jpeg,image/webp" hidden>

<div class="balance-tooltip" id="balance-tooltip" hidden></div>

<nav class="tab-bar">
  <div class="rank-chip">Your rank <strong id="tab-rank-value">--</strong></div>
  <button type="button" class="tab-btn active" data-view="ranking" aria-label="Ranking">${ICON_TROPHY_SM}</button>
  <button type="button" class="tab-btn" data-view="profile" aria-label="Profile">${ICON_USER}</button>
</nav>

<div class="modal-overlay" id="welcome-modal-overlay" hidden>
  <div class="modal-card welcome-modal-card" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
    <button type="button" class="icon-button welcome-modal-close" id="welcome-modal-close" aria-label="Close">${ICON_CLOSE}</button>
    <div class="welcome-modal-icon">${ICON_TROPHY_LG}</div>
    <h2 id="welcome-modal-title" class="welcome-modal-title">Are you the best in Lagos Life?</h2>
    <p class="welcome-modal-sub">Prove it.</p>
    <button type="button" class="cta-button" id="welcome-modal-cta" style="width:100%;justify-content:center">${ICON_PLUS} Submit your balance</button>
    <button type="button" class="btn-link welcome-modal-dismiss" id="welcome-modal-dismiss">Just looking for now</button>
  </div>
</div>

<div class="modal-overlay" id="sponsor-spotlight-overlay" hidden>
  <div class="modal-card welcome-modal-card" role="dialog" aria-modal="true" aria-labelledby="sponsor-spotlight-title">
    <button type="button" class="icon-button welcome-modal-close" id="sponsor-spotlight-close" aria-label="Close">${ICON_CLOSE}</button>
    <p class="sponsor-spotlight-eyebrow">This campaign is presented by</p>
    <a href="#" id="sponsor-spotlight-link" target="_blank" rel="noopener noreferrer sponsored" class="sponsor-spotlight-link">
      <img id="sponsor-spotlight-image" src="" alt="Sponsor logo" class="sponsor-spotlight-image">
    </a>
    <h2 id="sponsor-spotlight-title" class="welcome-modal-title">Thanks for supporting Lagos Life Forbes</h2>
    <button type="button" class="btn-link welcome-modal-dismiss" id="sponsor-spotlight-dismiss">Continue to the leaderboard</button>
  </div>
</div>

<div class="modal-overlay" id="submit-modal-overlay" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header">
      <h2 id="modal-title">Submit your balance</h2>
      <button type="button" class="icon-button" id="modal-close" aria-label="Close">${ICON_CLOSE}</button>
    </div>
    <form id="submit-form">
      <div id="submit-account-fields">
        <p class="form-section-note">Create an account so you can edit your profile, add an avatar, and update your balance later.</p>
        <div class="field">
          <label for="submit_email">Email</label>
          <input type="email" id="submit_email" name="email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="submit_password">Password</label>
          <div class="password-field-wrap">
            <input type="password" id="submit_password" name="password" minlength="8" autocomplete="new-password" required>
            <button type="button" class="password-toggle" data-for="submit_password" aria-label="Show password">${ICON_EYE}</button>
          </div>
        </div>
      </div>
      <div class="field">
        <label for="display_name">Your name</label>
        <input type="text" id="display_name" name="display_name" maxlength="60" required>
      </div>
      <div class="field">
        <label for="lagos_life_handle">Lagos Life username</label>
        <input type="text" id="lagos_life_handle" name="lagos_life_handle" maxlength="60" required>
      </div>
      <div class="field">
        <label for="reported_balance">Your balance (₦)</label>
        <input type="text" id="reported_balance" name="reported_balance" inputmode="numeric" maxlength="19" placeholder="e.g. 1,250,000" required>
      </div>
      <div class="field">
        <label for="screenshot">${ICON_CAMERA} Screenshot of your balance (required)</label>
        <input type="file" id="screenshot" name="screenshot" accept="image/png,image/jpeg,image/webp" required>
        <p class="form-section-note">Your screenshot must clearly show your balance. If you qualify, approved Lagos Life usernames may message you in the Lagos Life app to verify your balance.</p>
      </div>
      <div class="cf-turnstile" data-sitekey="${escapeAttr(siteKey)}"></div>
      <button type="submit" id="submit-button">Create account &amp; submit</button>
      <p id="submit-status"></p>
    </form>
    <div class="submit-success-state" id="submit-success-state" hidden>
      <p class="submit-success-message">Submitted! It'll appear once an admin reviews it.</p>
      <div class="submit-success-nudge" id="submit-success-nudge" hidden>
        <p class="submit-success-nudge-title">This leaderboard goes off every evening</p>
        <p class="submit-success-nudge-body">When tonight's rankings drop, everyone's watching. Get your Instagram, TikTok, X, or Snapchat seen right next to your name -- from ${socialUnlockPerDayLabel}/day.</p>
        <button type="button" class="btn-secondary" id="submit-success-nudge-btn">${ICON_MEGAPHONE} Show my socials</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="profile-edit-modal-overlay" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
    <div class="modal-header">
      <h2 id="profile-edit-title">Edit profile</h2>
      <button type="button" class="icon-button" id="profile-edit-close" aria-label="Close">${ICON_CLOSE}</button>
    </div>
    <form id="profile-edit-form">
      <div class="field">
        <label for="edit_display_name">Your name</label>
        <input type="text" id="edit_display_name" name="displayName" maxlength="60" required>
      </div>
      <div class="field">
        <label for="edit_lagos_life_handle">Lagos Life username</label>
        <input type="text" id="edit_lagos_life_handle" name="lagosLifeHandle" maxlength="60" required>
      </div>
      <div class="field">
        <label for="edit_avatar">${ICON_CAMERA} Avatar (your Lagos Life character, optional)</label>
        <input type="file" id="edit_avatar" name="avatar" accept="image/png,image/jpeg,image/webp">
      </div>
      <div class="field">
        <label for="edit_instagram">${ICON_INSTAGRAM} Instagram (optional)</label>
        <input type="text" id="edit_instagram" name="instagramHandle" maxlength="30" placeholder="username">
      </div>
      <div class="field">
        <label for="edit_tiktok">${ICON_TIKTOK} TikTok (optional)</label>
        <input type="text" id="edit_tiktok" name="tiktokHandle" maxlength="30" placeholder="username">
      </div>
      <div class="field">
        <label for="edit_twitter">${ICON_X} X / Twitter (optional)</label>
        <input type="text" id="edit_twitter" name="twitterHandle" maxlength="30" placeholder="username">
      </div>
      <div class="field">
        <label for="edit_snapchat">${ICON_SNAPCHAT} Snapchat (optional)</label>
        <input type="text" id="edit_snapchat" name="snapchatHandle" maxlength="30" placeholder="username">
      </div>
      <button type="submit" id="profile-edit-submit">Save profile</button>
      <p id="profile-edit-status"></p>
    </form>
  </div>
</div>

<div class="modal-overlay" id="auth-modal-overlay" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
    <div class="modal-header">
      <h2 id="auth-modal-title">Log in</h2>
      <button type="button" class="icon-button" id="auth-modal-close" aria-label="Close">${ICON_CLOSE}</button>
    </div>
    <p id="auth-intro" class="form-section-note">Log in to manage your profile, add your Lagos Life avatar, and update your balance anytime.</p>
    <div class="field">
      <label for="auth-email">Email</label>
      <input type="email" id="auth-email" autocomplete="email">
    </div>
    <div id="auth-profile-fields" hidden>
      <div class="field">
        <label for="auth-display-name">Your name</label>
        <input type="text" id="auth-display-name" maxlength="60">
      </div>
      <div class="field">
        <label for="auth-lagos-handle">Lagos Life username</label>
        <input type="text" id="auth-lagos-handle" maxlength="60">
      </div>
    </div>
    <div class="field">
      <label for="auth-password">Password</label>
      <div class="password-field-wrap">
        <input type="password" id="auth-password" autocomplete="current-password" minlength="8">
        <button type="button" class="password-toggle" data-for="auth-password" aria-label="Show password">${ICON_EYE}</button>
      </div>
    </div>
    <button type="button" class="cta-button" id="auth-submit" style="width:100%;justify-content:center">Log in</button>
    <p id="auth-status"></p>
    <p style="text-align:center"><button type="button" class="btn-link" id="auth-toggle">New here? Create an account</button></p>
  </div>
</div>

<div class="modal-overlay" id="advertise-modal-overlay" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="advertise-modal-title">
    <div class="modal-header">
      <h2 id="advertise-modal-title">Advertise here</h2>
      <button type="button" class="icon-button" id="advertise-modal-close" aria-label="Close">${ICON_CLOSE}</button>
    </div>
    <div id="advertise-modal-body"></div>
  </div>
</div>

<div class="modal-overlay" id="social-unlock-modal-overlay" hidden>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="social-unlock-modal-title">
    <div class="modal-header">
      <h2 id="social-unlock-modal-title">Show your socials</h2>
      <button type="button" class="icon-button" id="social-unlock-modal-close" aria-label="Close">${ICON_CLOSE}</button>
    </div>
    <p class="form-section-note">Everyone who checks the board sees your name -- might as well let them see your socials too, so they can follow or add you up. Your Instagram/TikTok/X/Snapchat icons show next to every entry you've got, podium or list, for however many days you pick.</p>
    <div class="field">
      <label>Quick pick</label>
      <div class="slot-picker" id="social-unlock-quick-picker">
        <button type="button" class="slot-option" data-days="1">1 day</button>
        <button type="button" class="slot-option" data-days="3">3 days</button>
        <button type="button" class="slot-option" data-days="7">7 days</button>
        <button type="button" class="slot-option" data-days="14">14 days</button>
      </div>
      <label for="social-unlock-days" style="margin-top:14px">Or enter days directly</label>
      <input type="number" id="social-unlock-days" min="1" max="90" value="1">
      <p class="social-unlock-price" id="social-unlock-price-display">${socialUnlockPerDayLabel}/day</p>
    </div>
    <button type="button" class="cta-button" id="social-unlock-submit" style="width:100%;justify-content:center">Continue to payment</button>
    <p id="social-unlock-status"></p>
  </div>
</div>

<script>
var ICON_PLUS_SVG = ${JSON.stringify(ICON_PLUS)};
var ICON_INSTAGRAM_SVG = ${JSON.stringify(ICON_INSTAGRAM)};
var ICON_TIKTOK_SVG = ${JSON.stringify(ICON_TIKTOK)};
var ICON_X_SVG = ${JSON.stringify(ICON_X)};
var ICON_SNAPCHAT_SVG = ${JSON.stringify(ICON_SNAPCHAT)};
var ICON_LOGOUT_SVG = ${JSON.stringify(ICON_LOGOUT)};
var ICON_MEGAPHONE_SVG = ${JSON.stringify(ICON_MEGAPHONE)};
var AD_SLOT_PRICES = {
  ranking_top: { day: ${JSON.stringify(adPricePremiumDayLabel)}, week: ${JSON.stringify(adPricePremiumWeekLabel)}, month: ${JSON.stringify(adPricePremiumMonthLabel)}, label: 'Leaderboard top' },
  ranking_bottom: { day: ${JSON.stringify(adPriceStandardDayLabel)}, week: ${JSON.stringify(adPriceStandardWeekLabel)}, month: ${JSON.stringify(adPriceStandardMonthLabel)}, label: 'Leaderboard bottom' },
  profile_tab: { day: ${JSON.stringify(adPriceStandardDayLabel)}, week: ${JSON.stringify(adPriceStandardWeekLabel)}, month: ${JSON.stringify(adPriceStandardMonthLabel)}, label: 'Profile tab' },
  campaign_banner: { flat: ${JSON.stringify(adPriceCampaignBannerLabel)}, label: 'Campaign sponsor' }
};
var SOCIAL_UNLOCK_PER_DAY_NAIRA = ${Math.round(socialUnlockPerDayKobo / 100)};
var ICON_USER_LG_SVG = ${JSON.stringify(ICON_USER_LG)};
var ICON_USER_SVG = ${JSON.stringify(ICON_USER)};
var ICON_EYE_SVG = ${JSON.stringify(ICON_EYE)};
var ICON_EYE_OFF_SVG = ${JSON.stringify(ICON_EYE_OFF)};
var ICON_CAMERA_SVG = ${JSON.stringify(ICON_CAMERA)};

document.querySelectorAll('.password-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var input = document.getElementById(btn.getAttribute('data-for'));
    var showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.innerHTML = showing ? ICON_EYE_SVG : ICON_EYE_OFF_SVG;
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
});

// Quick avatar update -- the camera badge on the profile avatar triggers
// this hidden input directly and uploads on selection, rather than
// routing through the full edit-profile modal just to change a photo.
document.getElementById('avatar-quick-input').addEventListener('change', async function () {
  var file = this.files[0];
  this.value = '';
  if (!file) return;
  var formData = new FormData();
  formData.append('avatar', file);
  try {
    var res = await fetch('/api/account/avatar', { method: 'POST', body: formData });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not update avatar.');
    await renderProfile();
  } catch (err) {
    alert(err.message || 'Could not update avatar.');
  }
});

var STORAGE_KEY = 'lagoslife_my_entry';
// All shades of gold now (was a mix including several greens) -- these
// cover the podium + table avatar fallback circles, the most-repeated
// colored element on the ranking page, so keeping it green-free matters
// more here than almost anywhere else on the page.
var AVATAR_PALETTE = ['#c8962c', '#e0b24c', '#a87820', '#f0c868', '#8a6218', '#d9a93f'];

function hashSeed(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}
// Every entry/account field rendered below (handle, display_name, social
// handles) is user-submitted and reaches this page through innerHTML
// string-building, not safe DOM methods -- this MUST wrap every one of
// them before interpolation, same obligation src/html.js's escapeHtml
// enforces server-side for the admin templates.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function avatarColor(seed) { return AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length]; }
function formatBalance(amount) {
  return Number(amount).toLocaleString('en-NG');
}
// Short form for display (1.2M, 5B, 1000T) -- entries.reported_balance
// is checked up to 999,999,999,999,999 in the DB, and the full
// comma-formatted number at that size is long enough to overflow a
// podium pill or wrap awkwardly in the profile hero display. Below 1M
// the plain comma-formatted number is already short, so it's left as-is
// rather than abbreviated down to e.g. "999,999" vs "1.0M".
function formatBalanceAbbrev(amount) {
  var n = Number(amount);
  if (n < 1000000) return n.toLocaleString('en-NG');
  var units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
  for (var i = 0; i < units.length; i++) {
    if (n >= units[i][0]) {
      var scaled = Math.round((n / units[i][0]) * 10) / 10;
      var label = (scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)) + units[i][1];
      return label;
    }
  }
  return n.toLocaleString('en-NG');
}
function coinHtml() { return '<span class="coin">\\u20a6</span>'; }

// Real uploaded avatar (account_id + has_avatar from the leaderboard/entry
// row) wins; otherwise a generic person icon on a deterministic colored
// circle -- a plain silhouette reads as "no profile picture set" more
// clearly than initials, which can look like a finished/intentional look.
function avatarMarkup(handle, className, accountId, hasAvatar) {
  if (accountId && hasAvatar) {
    return '<img class="' + className + '" src="/avatar/' + encodeURIComponent(accountId) + '" alt="">';
  }
  var icon = className.indexOf('profile-avatar-lg') !== -1 ? ICON_USER_LG_SVG : ICON_USER_SVG;
  return '<div class="' + className + '" style="background:' + avatarColor(handle) + '">' + icon + '</div>';
}

// The server only ever includes these handles when the entry's account
// currently has a paid unlock active (see getApprovedLeaderboard's own
// CASE WHEN) -- an account with nothing set and one with an expired/
// never-bought unlock look identical here (all three null), which is
// exactly the point: there's nothing for the client to gate again.
// Handles are URL-encoded (not just HTML-escaped) since they land in an
// href's path segment -- correct for the URL context AND sufficient to
// stop an attacker-controlled handle from breaking out of the
// surrounding "..." attribute.
function entrySocialRow(entry) {
  if (!entry.instagram_handle && !entry.tiktok_handle && !entry.twitter_handle && !entry.snapchat_handle) return '';
  var links = '';
  if (entry.instagram_handle) {
    links += '<a class="entry-social-link" href="https://instagram.com/' + encodeURIComponent(entry.instagram_handle) + '" target="_blank" rel="noopener noreferrer">' + ICON_INSTAGRAM_SVG + '</a>';
  }
  if (entry.tiktok_handle) {
    links += '<a class="entry-social-link" href="https://tiktok.com/@' + encodeURIComponent(entry.tiktok_handle) + '" target="_blank" rel="noopener noreferrer">' + ICON_TIKTOK_SVG + '</a>';
  }
  if (entry.twitter_handle) {
    links += '<a class="entry-social-link" href="https://x.com/' + encodeURIComponent(entry.twitter_handle) + '" target="_blank" rel="noopener noreferrer">' + ICON_X_SVG + '</a>';
  }
  if (entry.snapchat_handle) {
    links += '<a class="entry-social-link" href="https://www.snapchat.com/add/' + encodeURIComponent(entry.snapchat_handle) + '" target="_blank" rel="noopener noreferrer">' + ICON_SNAPCHAT_SVG + '</a>';
  }
  return '<div class="entry-social-row">' + links + '</div>';
}

function renderPodiumSlot(entry, place) {
  var handle = escapeHtml(entry.lagos_life_handle);
  return '<div class="podium-slot place-' + place + '">' +
    '<div class="avatar-wrap">' +
      '<div class="podium-avatar-ring">' + avatarMarkup(entry.lagos_life_handle, 'avatar', entry.account_id, entry.has_avatar) + '</div>' +
      '<div class="rank-badge">' + place + '</div>' +
    '</div>' +
    '<div class="podium-name">@' + handle + '</div>' +
    entrySocialRow(entry) +
    '<div class="podium-balance">' + coinHtml() + '<span class="balance-amount" data-full="\\u20a6' + formatBalance(entry.reported_balance) + '">' + formatBalanceAbbrev(entry.reported_balance) + '</span></div>' +
    '<div class="pedestal"><span class="num">' + place + '</span></div>' +
  '</div>';
}

function renderRestRow(entry, rank) {
  var handle = escapeHtml(entry.lagos_life_handle);
  return '<li>' +
    '<span class="rest-rank">' + rank + '</span>' +
    avatarMarkup(entry.lagos_life_handle, 'rest-avatar', entry.account_id, entry.has_avatar) +
    '<span class="rest-name" title="' + escapeHtml(entry.display_name) + '">@' + handle + '</span>' +
    entrySocialRow(entry) +
    '<span class="rest-balance">' + coinHtml() + '<span class="balance-amount" data-full="\\u20a6' + formatBalance(entry.reported_balance) + '">' + formatBalanceAbbrev(entry.reported_balance) + '</span></span>' +
  '</li>';
}

// campaignActive: whether a campaign is currently gating the board --
// only changes which empty-state line gets shown.
async function loadLeaderboard(campaignActive) {
  var loading = document.getElementById('board-loading');
  var empty = document.getElementById('board-empty');
  var emptyText = document.getElementById('board-empty-text');
  var podium = document.getElementById('podium');
  var tableHead = document.getElementById('table-head');
  var restList = document.getElementById('rest-list');
  try {
    var res = await fetch('/api/leaderboard');
    var data = await res.json();
    loading.hidden = true;
    // 403 means the server-side reveal embargo is still active -- normally
    // never reached (initRankingView only calls this once it's revealed),
    // but re-sync the gate instead of misreporting it as "no entries yet"
    // on the rare chance this races a boundary.
    if (!res.ok) {
      initRankingView();
      return;
    }
    var entries = data.entries || [];
    if (entries.length === 0) {
      emptyText.textContent = campaignActive
        ? 'No entries yet for this campaign -- be the first.'
        : "Nobody's submitted yet -- be the first.";
      empty.hidden = false;
      return;
    }

    var top3 = entries.slice(0, 3);
    // Visual podium order: 2nd (left), 1st (center, tallest), 3rd (right).
    var order = [];
    if (top3[1]) order.push({ entry: top3[1], place: 2 });
    if (top3[0]) order.push({ entry: top3[0], place: 1 });
    if (top3[2]) order.push({ entry: top3[2], place: 3 });
    podium.innerHTML = order.map(function (o) { return renderPodiumSlot(o.entry, o.place); }).join('');
    podium.hidden = false;

    var rest = entries.slice(3);
    if (rest.length > 0) {
      restList.innerHTML = rest.map(function (entry, i) { return renderRestRow(entry, i + 4); }).join('');
      restList.hidden = false;
      tableHead.hidden = false;
    }
  } catch (err) {
    loading.textContent = 'Could not load the leaderboard right now.';
  }
}

// The campaign's scheduled end (if any) is only actually applied
// server-side the next time something checks it (see getActiveCampaign)
// -- there's no cron job ticking it over. So once the client-side
// countdown hits zero, re-run initRankingView() to pick up that
// transition instead of just freezing on "0m left".
var campaignCountdownInterval = null;
function formatCampaignRemaining(secondsLeft) {
  var days = Math.floor(secondsLeft / 86400);
  var hours = Math.floor((secondsLeft % 86400) / 3600);
  var minutes = Math.floor((secondsLeft % 3600) / 60);
  var seconds = secondsLeft % 60;
  if (days >= 1) return days + 'd ' + hours + 'h left';
  if (hours >= 1) return hours + 'h ' + minutes + 'm left';
  return minutes + 'm ' + seconds + 's left';
}
function startCampaignCountdown(endsAtSeconds) {
  var wrapper = document.getElementById('campaign-banner-countdown');
  var el = document.getElementById('campaign-banner-countdown-value');
  if (campaignCountdownInterval) { clearInterval(campaignCountdownInterval); campaignCountdownInterval = null; }
  if (!endsAtSeconds) {
    if (wrapper) wrapper.hidden = false;
    if (el) el.textContent = 'Campaign is live';
    return;
  }
  if (wrapper) wrapper.hidden = false;
  function tick() {
    var secondsLeft = endsAtSeconds - Math.floor(Date.now() / 1000);
    if (secondsLeft <= 0) {
      clearInterval(campaignCountdownInterval);
      campaignCountdownInterval = null;
      el.textContent = 'Ending now\\u2026';
      initRankingView();
      return;
    }
    el.textContent = formatCampaignRemaining(secondsLeft);
  }
  tick();
  campaignCountdownInterval = setInterval(tick, 1000);
}
// Distinct from startCampaignCountdown(null) -- that call means "an
// active campaign with no fixed end date, show 'Campaign is live'
// permanently." This means "no campaign at all," so the row must stay
// hidden, not get relabeled and shown.
function stopCampaignCountdown() {
  if (campaignCountdownInterval) { clearInterval(campaignCountdownInterval); campaignCountdownInterval = null; }
  var wrapper = document.getElementById('campaign-banner-countdown');
  if (wrapper) wrapper.hidden = true;
}

function setTopSubmitVisibility(campaignActive) {
  var topSubmitRow = document.getElementById('top-submit-row');
  if (!topSubmitRow) return;
  topSubmitRow.hidden = !!campaignActive;
}

// Separate interval/element from the campaign-end countdown above --
// this one lives in the gate (not the banner) and ticks down to the
// next daily reveal moment, not the campaign's own end.
var campaignRevealCountdownInterval = null;
function startRevealCountdown(nextRevealAtSeconds) {
  if (campaignRevealCountdownInterval) { clearInterval(campaignRevealCountdownInterval); campaignRevealCountdownInterval = null; }
  if (!nextRevealAtSeconds) return;
  var el = document.getElementById('campaign-gate-countdown');
  function tick() {
    var secondsLeft = nextRevealAtSeconds - Math.floor(Date.now() / 1000);
    if (secondsLeft <= 0) {
      clearInterval(campaignRevealCountdownInterval);
      campaignRevealCountdownInterval = null;
      el.textContent = 'Revealing now\\u2026';
      initRankingView();
      return;
    }
    el.textContent = formatCampaignRemaining(secondsLeft);
  }
  tick();
  campaignRevealCountdownInterval = setInterval(tick, 1000);
}

// For a campaign with a sneak-peek close time (not just a reveal time):
// silently re-checks right when today's window shuts, so someone who
// left the tab open through close sees it actually re-gate live instead
// of a stale board sitting there until some other action refreshes it.
// No visible countdown here (unlike the two above) -- it's a one-shot
// correction, not something worth ticking down on screen.
var campaignCloseTimeout = null;
function watchCampaignClose(closesAtSeconds) {
  if (campaignCloseTimeout) { clearTimeout(campaignCloseTimeout); campaignCloseTimeout = null; }
  if (!closesAtSeconds) return;
  var msUntilClose = (closesAtSeconds - Math.floor(Date.now() / 1000)) * 1000;
  if (msUntilClose <= 0) { initRankingView(); return; }
  campaignCloseTimeout = setTimeout(function () { initRankingView(); }, msUntilClose);
}

// Runs before loadLeaderboard() -- decides whether this visitor sees the
// real board, the "submit to unlock" gate, or (for a campaign with a
// daily reveal time configured) a "you're in, come back at X" gate for
// the active campaign (if any). Re-run after a successful submission
// too, since that's exactly the moment someone might just now be
// unlocking it, and again automatically once a countdown above hits zero.
async function initRankingView() {
  var gate = document.getElementById('campaign-gate');
  var submitState = document.getElementById('campaign-gate-submit-state');
  var revealState = document.getElementById('campaign-gate-reveal-state');
  var banner = document.getElementById('campaign-banner');
  var frozenBanner = document.getElementById('frozen-results-banner');
  var loading = document.getElementById('board-loading');
  var status = null;

  try {
    var res = await fetch('/api/campaign/status');
    status = await res.json();
    latestCampaignStatus = status;
    applyProfileSubmitButtonState();
    refreshAnnouncementsPopover(status);

    if (status.active) {
      banner.hidden = false;
      frozenBanner.hidden = true;
      setTopSubmitVisibility(true);
      document.getElementById('campaign-banner-title').textContent = '\\ud83c\\udfc6 ' + status.campaign.name;
      var rewardEl = document.getElementById('campaign-banner-reward');
      rewardEl.textContent = status.campaign.rewardDescription ? ('Award: ' + status.campaign.rewardDescription) : '';
      rewardEl.hidden = !status.campaign.rewardDescription;
      startCampaignCountdown(status.campaign.endsAt);
    } else {
      banner.hidden = true;
      setTopSubmitVisibility(false);
      stopCampaignCountdown();
      if (status.lastEndedCampaign) {
        frozenBanner.hidden = false;
        document.getElementById('frozen-results-name').textContent = status.lastEndedCampaign.name;
      } else {
        frozenBanner.hidden = true;
      }
    }

    if (status.active && !status.unlocked) {
      gate.hidden = false;
      submitState.hidden = false;
      revealState.hidden = true;
      startRevealCountdown(null);
      watchCampaignClose(null);
      loading.hidden = true;
      return;
    }

    if (status.active && status.unlocked && !status.campaign.revealed) {
      gate.hidden = false;
      submitState.hidden = true;
      revealState.hidden = false;
      loading.hidden = true;
      var revealMsgEl = document.getElementById('campaign-gate-reveal-message');
      var endMsgEl = document.getElementById('campaign-gate-reveal-end-message');
      // 'end' mode has no daily reveal time at all -- status.campaign.nextRevealAt
      // is null here (see nextCampaignRevealAt's own revealAtEnd short-circuit),
      // so this branches to entirely different messaging instead of feeding
      // null into new Date(null * 1000) and showing a garbage time.
      if (status.campaign.revealAtEnd) {
        revealMsgEl.hidden = true;
        endMsgEl.hidden = false;
        var endFragmentEl = document.getElementById('campaign-gate-end-fragment');
        var endTimeEl = document.getElementById('campaign-gate-end-time');
        if (status.campaign.endsAt) {
          var endDate = new Date(status.campaign.endsAt * 1000);
          endTimeEl.textContent = endDate.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
          endFragmentEl.hidden = false;
        } else {
          endFragmentEl.hidden = true;
        }
        startRevealCountdown(status.campaign.endsAt || null);
        watchCampaignClose(null);
        return;
      }
      revealMsgEl.hidden = false;
      endMsgEl.hidden = true;
      var revealTimeEl = document.getElementById('campaign-gate-reveal-time');
      var closeFragmentEl = document.getElementById('campaign-gate-close-fragment');
      var closeTimeEl = document.getElementById('campaign-gate-close-time');
      var revealDate = new Date(status.campaign.nextRevealAt * 1000);
      revealTimeEl.textContent = revealDate.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
      if (status.campaign.closesAt && status.campaign.closesAt > status.campaign.nextRevealAt) {
        var closeDate = new Date(status.campaign.closesAt * 1000);
        closeTimeEl.textContent = closeDate.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
        closeFragmentEl.hidden = false;
      } else {
        closeFragmentEl.hidden = true;
      }
      startRevealCountdown(status.campaign.nextRevealAt);
      watchCampaignClose(null);
      return;
    }

    startRevealCountdown(null);
    watchCampaignClose(status.active ? status.campaign.closesAt : null);
  } catch (err) {
    // Fail open to the normal leaderboard if the campaign check itself
    // errors -- worst case someone sees the board a beat before a gate
    // would've shown, not a page stuck loading forever.
    latestCampaignStatus = null;
    applyProfileSubmitButtonState();
    setTopSubmitVisibility(false);
    stopCampaignCountdown();
    refreshAnnouncementsPopover(null);
  }

  gate.hidden = true;
  loadLeaderboard(!!(status && status.active));
}
document.getElementById('campaign-gate-submit-btn').addEventListener('click', function () { openModal(); });
initRankingView();

var PRESENCE_INTERVAL_MS = 30000;

async function pingPresence() {
  try { await fetch('/api/presence/ping', { method: 'POST' }); } catch (err) {}
}

// Each stat only starts showing once it's big enough to actually be
// impressive -- a "3 here now" or "41 all-time" reads as a dead page,
// so better to show nothing at all below these thresholds.
var LIVE_VISITOR_REVEAL_THRESHOLD = 10000;
var TOTAL_VISITOR_REVEAL_THRESHOLD = 20000;

async function refreshVisitorStats() {
  try {
    var res = await fetch('/api/presence/stats');
    if (!res.ok) return;
    var data = await res.json();
    var live = Number(data.live || 0);
    var total = Number(data.total || 0);
    document.getElementById('live-visitor-count').textContent = live.toLocaleString('en-NG');
    document.getElementById('total-visitor-count').textContent = total.toLocaleString('en-NG');
    document.getElementById('live-visitor-stat').hidden = live < LIVE_VISITOR_REVEAL_THRESHOLD;
    document.getElementById('total-visitor-stat').hidden = total < TOTAL_VISITOR_REVEAL_THRESHOLD;
  } catch (err) {}
}

function tickPresence() {
  pingPresence();
  refreshVisitorStats();
}
tickPresence();
setInterval(function () {
  // Skip while the tab is hidden/backgrounded -- no point pinging (or
  // paying for the DO request) for a tab nobody's actually looking at.
  if (document.visibilityState === 'visible') tickPresence();
}, PRESENCE_INTERVAL_MS);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') tickPresence();
});

function getSavedEntry() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (err) { return null; }
}
function saveEntry(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (err) {}
}

function statusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending review';
}

function updateRankChip(entry) {
  var valueEl = document.getElementById('tab-rank-value');
  valueEl.textContent = (entry && entry.status === 'approved' && entry.rank) ? ('#' + entry.rank) : '--';
}

async function fetchMyAnonymousEntry() {
  var saved = getSavedEntry();
  if (!saved) return null;
  try {
    var res = await fetch('/api/entry/' + encodeURIComponent(saved.id));
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

// null = logged out. Refreshed by fetchMe() whenever login state changes
// (initial load, after verifying a code, after logging out, after editing
// the profile) -- used to prefill the submit-balance modal so a returning
// logged-in visitor doesn't retype their name/handle every time.
var currentAccount = null;
// Latest response from /api/campaign/status. Used so the Profile tab's
// submit CTA mirrors campaign rules (e.g. one entry per active campaign).
var latestCampaignStatus = null;

function getProfileSubmitButtonConfig(hasEntries) {
  if (latestCampaignStatus && latestCampaignStatus.active) {
    if (latestCampaignStatus.unlocked) {
      return {
        label: 'Entered campaign',
        showPlus: false,
        disabled: true,
        title: 'You already submitted for this campaign.'
      };
    }
    return {
      label: hasEntries ? 'Submit campaign' : 'Submit balance',
      showPlus: true,
      disabled: false,
      title: ''
    };
  }
  return {
    label: hasEntries ? 'Submit another' : 'Submit balance',
    showPlus: true,
    disabled: false,
    title: ''
  };
}

function applyProfileSubmitButtonState() {
  var btn = document.getElementById('profile-submit-btn');
  if (!btn) return;
  var hasEntries = btn.getAttribute('data-has-entries') === '1';
  var config = getProfileSubmitButtonConfig(hasEntries);
  btn.disabled = !!config.disabled;
  btn.classList.toggle('profile-submit-disabled', !!config.disabled);
  btn.title = config.title || '';
  btn.innerHTML = (config.showPlus ? (ICON_PLUS_SVG + ' ') : '') + config.label;
}

async function fetchMe() {
  try {
    var res = await fetch('/api/auth/me');
    if (!res.ok) { currentAccount = null; return null; }
    var data = await res.json();
    currentAccount = data.account;
    return data;
  } catch (err) {
    currentAccount = null;
    return null;
  }
}

async function refreshRankChip() {
  var me = await fetchMe();
  if (me) { updateRankChip((me.entries && me.entries[0]) || null); return; }
  updateRankChip(await fetchMyAnonymousEntry());
}
refreshRankChip();

// No "Submit your balance" button here -- that CTA already lives on the
// Ranking tab, so this just reports status rather than duplicating it.
function entryStatusBlock(entry) {
  if (!entry) {
    return '<p class="empty-state">No balance submitted yet.</p>';
  }
  var rankLine = (entry.status === 'approved' && entry.rank)
    ? '<div class="profile-rank">Rank #' + entry.rank + ' on the leaderboard</div>'
    : (entry.status === 'approved' && entry.rankRevealed === false
      ? '<div class="profile-rank profile-rank-locked">Rank revealed once tonight\\'s results go live</div>'
      : '');
  var note = entry.status === 'rejected'
    ? '<p class="profile-note">Not approved' + (entry.rejection_reason ? ': ' + escapeHtml(entry.rejection_reason) : '.') + '</p>'
    : (entry.status === 'pending' ? '<p class="profile-note">Waiting for an admin to review your screenshot.</p>' : '');
  return '<span class="status-badge status-' + entry.status + '">' + statusLabel(entry.status) + '</span>' +
    '<div class="profile-balance">' + coinHtml() + '<span class="balance-amount" data-full="\\u20a6' + formatBalance(entry.reported_balance) + '">' + formatBalanceAbbrev(entry.reported_balance) + '</span></div>' +
    rankLine + note;
}

// Logged-out anonymous fallback (pre-accounts behavior) -- a localStorage
// entry from before this visitor ever logged in still shows here, just
// without the editable-profile/avatar features an account unlocks.
function renderAnonymousStatus() {
  fetchMyAnonymousEntry().then(function (entry) {
    var block = document.getElementById('anon-status-block');
    if (!block) return;
    block.innerHTML = entryStatusBlock(entry);
  });
}

// Logged-out Profile tab: looks like the real profile card's shell (same
// avatar-ring position, same card styling) but with a generic placeholder
// icon instead of real data, plus a button that opens the auth modal --
// matching the submit-balance modal's pattern instead of showing the
// email/password form inline in the tab.
function renderLoginForm() {
  var container = document.getElementById('profile-content');
  container.innerHTML =
    '<div class="profile-card">' +
      '<div class="profile-avatar-block"><div class="profile-avatar-ring">' +
        '<div class="avatar profile-avatar-lg profile-placeholder-icon">' + ICON_USER_LG_SVG + '</div>' +
      '</div></div>' +
      '<p class="profile-note">Sign in to see your profile</p>' +
      '<div class="profile-actions">' +
        '<button type="button" class="cta-button" id="open-auth-modal" style="width:100%;justify-content:center">Sign up or log in</button>' +
      '</div>' +
    '</div>' +
    '<p class="anon-status-divider">Submitted before without logging in?</p>' +
    '<div id="anon-status-block"></div>';

  document.getElementById('open-auth-modal').addEventListener('click', openAuthModal);
  renderAnonymousStatus();
}

function verifiedBadgeHtml() {
  return '<svg class="verified-badge" viewBox="0 0 24 24" width="18" height="18">' +
    '<circle cx="12" cy="12" r="10" fill="currentColor"/>' +
    '<path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';
}

// Always rendered once logged in (even with nothing set yet) -- an unset
// slot is a muted, dashed "add" button instead of being hidden entirely,
// so people discover that adding socials is an option rather than only
// finding it by accident inside the edit-profile modal.
function socialIconButton(icon, url) {
  if (url) {
    return '<a class="social-icon-btn" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + icon + '</a>';
  }
  return '<button type="button" class="social-icon-btn unset" aria-label="Add social link">' + icon + '</button>';
}

// Paid perk -- socialUnlockEndsAt is only ever set/extended by a
// confirmed payment (see markSocialUnlockPaid server-side); this just
// reflects whatever the account record already says, same source of
// truth the leaderboard query itself checks before it'll ever include
// these handles for other visitors to see.
function renderSocialUnlockStatus(account) {
  var endsAt = account.socialUnlockEndsAt;
  var active = endsAt && endsAt * 1000 > Date.now();
  if (active) {
    var dateLabel = new Date(endsAt * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<button type="button" class="social-unlock-banner active" id="social-unlock-open-btn">' +
      '<span class="social-unlock-dot"></span> Socials showing on leaderboard until ' + dateLabel +
    '</button>';
  }
  return '<button type="button" class="social-unlock-banner" id="social-unlock-open-btn">' +
    ICON_MEGAPHONE_SVG + ' Show your socials on the leaderboard' +
  '</button>';
}

function formatHistoryDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

function renderLoggedInProfile(account, entries) {
  var container = document.getElementById('profile-content');
  var latest = entries[0] || null;
  var isVerified = !!(latest && latest.status === 'approved');
  var avatarEl = avatarMarkup(account.lagosLifeHandle || account.displayName || '?', 'avatar profile-avatar-lg', account.id, account.hasAvatar);

  var rankPillHtml = (latest && latest.status === 'approved' && latest.rank)
    ? '<div class="profile-rank-pill">Rank #' + latest.rank + '</div>'
    : '<div class="profile-rank-pill unranked">Not yet ranked</div>';

  var socialRowHtml = socialIconButton(ICON_INSTAGRAM_SVG, account.instagramUrl) +
    socialIconButton(ICON_TIKTOK_SVG, account.tiktokUrl) +
    socialIconButton(ICON_X_SVG, account.twitterUrl) +
    socialIconButton(ICON_SNAPCHAT_SVG, account.snapchatUrl);
  var socialUnlockHtml = renderSocialUnlockStatus(account);
  var submitConfig = getProfileSubmitButtonConfig(entries.length > 0);

  var statsHtml =
    '<div class="profile-stat"><span class="stat-value">' + (latest ? '<span class="balance-amount" data-full="\\u20a6' + formatBalance(latest.reported_balance) + '">\\u20a6' + formatBalanceAbbrev(latest.reported_balance) + '</span>' : '--') + '</span><span class="stat-label">Balance</span></div>' +
    '<div class="profile-stat"><span class="stat-value">' + (latest && latest.status === 'approved' && latest.rank ? '#' + latest.rank : '--') + '</span><span class="stat-label">Rank</span></div>' +
    '<div class="profile-stat"><span class="stat-value">' + (latest ? statusLabel(latest.status) : '--') + '</span><span class="stat-label">Status</span></div>';

  var historyHtml = entries.length
    ? '<div class="profile-history"><h3>Recent submissions</h3><ul class="history-list">' +
        entries.map(function (e) {
          return '<li class="history-item">' +
            '<span class="history-balance">' + coinHtml() + '<span class="balance-amount" data-full="\\u20a6' + formatBalance(e.reported_balance) + '">' + formatBalanceAbbrev(e.reported_balance) + '</span></span>' +
            '<span class="status-badge status-' + e.status + '">' + statusLabel(e.status) + '</span>' +
            '<span class="history-date">' + formatHistoryDate(e.created_at) + '</span>' +
          '</li>';
        }).join('') +
      '</ul></div>'
    : '';

  container.innerHTML =
    '<div class="profile-card">' +
      '<div class="profile-avatar-block"><div class="profile-avatar-ring">' + avatarEl + '</div>' +
        '<button type="button" class="avatar-camera-badge" id="avatar-camera-btn" aria-label="Update avatar photo">' + ICON_CAMERA_SVG + '</button>' +
        rankPillHtml + '</div>' +
      '<div class="profile-name-row"><span class="profile-name-text">' + escapeHtml(account.displayName || 'Set your name') + '</span>' + (isVerified ? verifiedBadgeHtml() : '') + '</div>' +
      (account.lagosLifeHandle ? '<div class="profile-handle-text">@' + escapeHtml(account.lagosLifeHandle) + '</div>' : '<div class="profile-handle-text">&nbsp;</div>') +
      '<div class="profile-social-row">' + socialRowHtml + '</div>' +
      socialUnlockHtml +
      '<div class="profile-stats-row">' + statsHtml + '</div>' +
      '<div class="profile-actions-row">' +
        '<button type="button" class="icon-button" id="profile-logout-btn" aria-label="Log out">' + ICON_LOGOUT_SVG + '</button>' +
        '<button type="button" class="btn-secondary" id="profile-edit-btn">Edit profile</button>' +
        '<button type="button" class="cta-button' + (submitConfig.disabled ? ' profile-submit-disabled' : '') + '" id="profile-submit-btn" data-has-entries="' + (entries.length ? '1' : '0') + '"' + (submitConfig.disabled ? ' disabled' : '') + (submitConfig.title ? ' title="' + submitConfig.title + '"' : '') + '>' + (submitConfig.showPlus ? (ICON_PLUS_SVG + ' ') : '') + submitConfig.label + '</button>' +
      '</div>' +
    '</div>' +
    historyHtml;

  document.getElementById('profile-edit-btn').addEventListener('click', openProfileEditModal);
  document.getElementById('profile-submit-btn').addEventListener('click', function () {
    if (this.disabled) return;
    openModal();
  });
  applyProfileSubmitButtonState();
  document.getElementById('avatar-camera-btn').addEventListener('click', function () {
    document.getElementById('avatar-quick-input').click();
  });
  document.querySelectorAll('.social-icon-btn.unset').forEach(function (btn) {
    btn.addEventListener('click', openProfileEditModal);
  });
  var socialUnlockBtn = document.getElementById('social-unlock-open-btn');
  if (socialUnlockBtn) socialUnlockBtn.addEventListener('click', openSocialUnlockModal);
  document.getElementById('profile-logout-btn').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentAccount = null;
    await renderProfile();
    refreshRankChip();
  });
}

async function renderProfile() {
  document.getElementById('profile-content').innerHTML = '<p class="loading-state">Loading&hellip;</p>';
  var me = await fetchMe();
  if (me) {
    renderLoggedInProfile(me.account, me.entries || []);
  } else {
    renderLoginForm();
  }
}

// 'announcements' is a real view here (not a modal/page nav) but has no
// matching .tab-btn in the bottom bar on purpose -- it's reachable only
// from the header popover's "View all" link, not a primary destination
// like Ranking/Profile. The .tab-btn loop below naturally deactivates
// both tab buttons for it, since neither's data-view matches.
// view is mirrored into location.hash (replaceState, not a real
// navigation -- no new history entry per tab switch) so a reload lands
// back on whatever tab was open instead of always resetting to Ranking.
// 'ranking' clears the hash entirely rather than writing "#ranking",
// since it's the default landing state.
function setView(view) {
  document.getElementById('view-ranking').hidden = view !== 'ranking';
  document.getElementById('view-profile').hidden = view !== 'profile';
  document.getElementById('view-announcements').hidden = view !== 'announcements';
  // The disclaimer/review-note/advertise footer is about the leaderboard
  // itself -- not relevant context on the Announcements view, so it only
  // shows for the two real tab destinations.
  document.getElementById('page-footer').hidden = view === 'announcements';
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'profile') renderProfile();
  if (view === 'announcements') renderFullAnnouncementsList();
  try {
    var url = location.pathname + location.search + (view === 'ranking' ? '' : '#' + view);
    history.replaceState(null, '', url);
  } catch (err) {}
}
document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { setView(btn.dataset.view); });
});

document.getElementById('announcements-view-all-btn').addEventListener('click', function () {
  closeAnnouncementsPopover();
  setView('announcements');
});
document.getElementById('announcements-back-link').addEventListener('click', function () { setView('ranking'); });

// Restores whichever tab was open on reload/direct link -- the HTML's
// own default (view-ranking visible, nothing hidden toggled yet) is
// already correct for the no-hash case, so this only needs to act for
// the two non-default views.
(function initViewFromHash() {
  var requestedView = location.hash.replace('#', '');
  if (requestedView === 'profile' || requestedView === 'announcements') {
    setView(requestedView);
  }
})();

// Full history (no limit), rendered as real DOM nodes -- same reasoning
// as the header popover's renderer: titles/bodies are admin-authored
// free text, not pre-sanitized markup.
async function renderFullAnnouncementsList() {
  var container = document.getElementById('announcements-full-list');
  container.innerHTML = '<p class="loading-state">Loading&hellip;</p>';
  try {
    var res = await fetch('/api/announcements');
    var data = await res.json();
    var announcements = data.announcements || [];
    if (announcements.length === 0) {
      container.innerHTML = '';
      var emptyState = document.createElement('div');
      emptyState.className = 'board-empty-state';
      var emptyIcon = document.createElement('span');
      emptyIcon.className = 'board-empty-icon';
      emptyIcon.innerHTML = ${JSON.stringify(ICON_BELL_OFF)};
      var emptyText = document.createElement('p');
      emptyText.className = 'board-empty-text';
      emptyText.textContent = 'No announcements yet -- check back soon.';
      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyText);
      container.appendChild(emptyState);
      return;
    }
    var list = document.createElement('div');
    list.className = 'announcement-list';
    announcements.forEach(function (a) {
      var card = document.createElement('div');
      card.className = 'announcement-card';

      var headerRow = document.createElement('div');
      headerRow.className = 'announcement-card-header';

      var iconEl = document.createElement('span');
      iconEl.className = 'announcement-card-icon';
      iconEl.innerHTML = ${JSON.stringify(ICON_BELL.replace('width="19" height="19"', 'width="15" height="15"'))};
      headerRow.appendChild(iconEl);

      var titleWrap = document.createElement('div');
      var titleEl = document.createElement('div');
      titleEl.className = 'announcement-card-title';
      titleEl.textContent = a.title;
      var dateEl = document.createElement('div');
      dateEl.className = 'announcement-card-date';
      dateEl.textContent = new Date(a.createdAt * 1000).toLocaleString('en-NG');
      titleWrap.appendChild(titleEl);
      titleWrap.appendChild(dateEl);
      headerRow.appendChild(titleWrap);

      var bodyEl = document.createElement('p');
      bodyEl.className = 'announcement-card-body';
      bodyEl.textContent = a.body;

      card.appendChild(headerRow);
      card.appendChild(bodyEl);
      list.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(list);
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load announcements right now.</p>';
  }
}

var modalOverlay = document.getElementById('submit-modal-overlay');

function setSubmitAccountFieldsEnabled(enabled) {
  var accountFields = document.getElementById('submit-account-fields');
  if (!accountFields) return;
  accountFields.hidden = !enabled;

  var emailInput = document.getElementById('submit_email');
  var passwordInput = document.getElementById('submit_password');
  if (emailInput) {
    emailInput.disabled = !enabled;
    emailInput.required = enabled;
  }
  if (passwordInput) {
    passwordInput.disabled = !enabled;
    passwordInput.required = enabled;
  }
}

function openModal() {
  var submitForm = document.getElementById('submit-form');
  var successState = document.getElementById('submit-success-state');
  var status = document.getElementById('submit-status');
  var submitButton = document.getElementById('submit-button');
  submitForm.hidden = false;
  successState.hidden = true;
  status.className = '';
  status.textContent = '';
  if (currentAccount) {
    // Already have an account -- no need to create one, just submit.
    setSubmitAccountFieldsEnabled(false);
    submitButton.textContent = 'Submit for review';
    if (currentAccount.displayName) document.getElementById('display_name').value = currentAccount.displayName;
    if (currentAccount.lagosLifeHandle) document.getElementById('lagos_life_handle').value = currentAccount.lagosLifeHandle;
  } else {
    // Submitting a balance doubles as account creation -- collect email
    // + password in the same form/modal instead of a separate signup step.
    setSubmitAccountFieldsEnabled(true);
    submitButton.textContent = 'Create account & submit';
  }
  document.getElementById('submit-success-nudge').hidden = true;
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('open-submit-modal').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function (event) {
  if (event.target === modalOverlay) closeModal();
});

var profileEditModalOverlay = document.getElementById('profile-edit-modal-overlay');
function openProfileEditModal() {
  if (currentAccount) {
    document.getElementById('edit_display_name').value = currentAccount.displayName || '';
    document.getElementById('edit_lagos_life_handle').value = currentAccount.lagosLifeHandle || '';
    document.getElementById('edit_instagram').value = currentAccount.instagramHandle || '';
    document.getElementById('edit_tiktok').value = currentAccount.tiktokHandle || '';
    document.getElementById('edit_twitter').value = currentAccount.twitterHandle || '';
    document.getElementById('edit_snapchat').value = currentAccount.snapchatHandle || '';
  }
  profileEditModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeProfileEditModal() {
  profileEditModalOverlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('profile-edit-close').addEventListener('click', closeProfileEditModal);
profileEditModalOverlay.addEventListener('click', function (event) {
  if (event.target === profileEditModalOverlay) closeProfileEditModal();
});

var authModalOverlay = document.getElementById('auth-modal-overlay');
var authMode = 'login';
function applyAuthMode() {
  var isLogin = authMode === 'login';
  document.getElementById('auth-modal-title').textContent = isLogin ? 'Log in' : 'Create account';
  document.getElementById('auth-intro').textContent = isLogin
    ? 'Log in to manage your profile, add your Lagos Life avatar, and update your balance anytime.'
    : 'Create an account to manage your profile, add your Lagos Life avatar, and update your balance anytime.';
  document.getElementById('auth-profile-fields').hidden = isLogin;
  document.getElementById('auth-submit').textContent = isLogin ? 'Log in' : 'Create account';
  document.getElementById('auth-toggle').textContent = isLogin ? 'New here? Create an account' : 'Already have an account? Log in';
  document.getElementById('auth-password').autocomplete = isLogin ? 'current-password' : 'new-password';
}
function openAuthModal() {
  authMode = 'login';
  applyAuthMode();
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-display-name').value = '';
  document.getElementById('auth-lagos-handle').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-status').className = '';
  document.getElementById('auth-status').textContent = '';
  authModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  authModalOverlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
authModalOverlay.addEventListener('click', function (event) {
  if (event.target === authModalOverlay) closeAuthModal();
});
document.getElementById('auth-toggle').addEventListener('click', function () {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auth-status').className = '';
  document.getElementById('auth-status').textContent = '';
  applyAuthMode();
});
document.getElementById('auth-submit').addEventListener('click', async function () {
  var submitBtn = this;
  var statusEl = document.getElementById('auth-status');
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var displayName = document.getElementById('auth-display-name').value.trim();
  var lagosLifeHandle = document.getElementById('auth-lagos-handle').value.trim();
  statusEl.className = '';
  statusEl.textContent = '';
  if (!email || !password) { statusEl.className = 'error'; statusEl.textContent = 'Enter your email and password.'; return; }
  if (authMode === 'signup' && (!displayName || !lagosLifeHandle)) {
    statusEl.className = 'error';
    statusEl.textContent = 'Enter your name and Lagos Life username.';
    return;
  }
  submitBtn.disabled = true;
  try {
    var payload = { email: email, password: password };
    if (authMode === 'signup') {
      payload.displayName = displayName;
      payload.lagosLifeHandle = lagosLifeHandle;
    }
    var res = await fetch(authMode === 'login' ? '/api/auth/login' : '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong.');
    closeAuthModal();
    await renderProfile();
    refreshRankChip();
  } catch (err) {
    statusEl.className = 'error';
    statusEl.textContent = err.message || 'Something went wrong.';
  } finally {
    submitBtn.disabled = false;
  }
});

var advertiseModalOverlay = document.getElementById('advertise-modal-overlay');
var selectedAdSlot = null;
var selectedAdPackage = null;

function renderPackagePickerForSlot(slot) {
  var field = document.getElementById('advertise-package-field');
  var note = document.getElementById('advertise-campaign-note');
  var prices = AD_SLOT_PRICES[slot];
  var imageLabel = document.getElementById('advertise-image-label');
  selectedAdPackage = null;

  if (imageLabel) {
    imageLabel.innerHTML = slot === 'campaign_banner'
      ? ICON_CAMERA_SVG + ' Your logo'
      : ICON_CAMERA_SVG + ' Ad image';
  }

  if (slot === 'campaign_banner') {
    field.hidden = true;
    note.hidden = false;
    note.innerHTML = '<p class="form-section-note">Sponsors the currently running campaign for its full duration -- upload your logo and the link it should open, shown to every visitor while the campaign runs -- ' + prices.flat + '.</p>';
    return;
  }

  note.hidden = true;
  field.hidden = false;
  document.getElementById('advertise-package-picker').innerHTML =
    '<button type="button" class="package-option" data-package="day">1 day<br>' + prices.day + '</button>' +
    '<button type="button" class="package-option" data-package="week">1 week<br>' + prices.week + '</button>' +
    '<button type="button" class="package-option" data-package="month">1 month<br>' + prices.month + '</button>';
  document.querySelectorAll('#advertise-package-picker .package-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedAdPackage = btn.getAttribute('data-package');
      document.querySelectorAll('#advertise-package-picker .package-option').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    });
  });
}

async function renderAdvertiseModalBody() {
  var body = document.getElementById('advertise-modal-body');
  if (!currentAccount) {
    body.innerHTML =
      '<p class="empty-state">Log in to advertise on this page.</p>' +
      '<button type="button" class="cta-button" id="advertise-login-btn" style="width:100%;justify-content:center">Log in</button>';
    document.getElementById('advertise-login-btn').addEventListener('click', function () {
      closeAdvertiseModal();
      openAuthModal();
    });
    return;
  }

  var campaignActive = false;
  try {
    var campaignRes = await fetch('/api/campaign/status');
    var campaignStatus = await campaignRes.json();
    campaignActive = !!campaignStatus.active;
  } catch (err) {}

  selectedAdSlot = null;
  selectedAdPackage = null;
  var slotButtons = ['ranking_top', 'ranking_bottom', 'profile_tab', 'campaign_banner'].map(function (slot) {
    var disabled = slot === 'campaign_banner' && !campaignActive;
    return '<button type="button" class="slot-option" data-slot="' + slot + '"' + (disabled ? ' disabled title="Only available while a campaign is running"' : '') + '>' +
      AD_SLOT_PRICES[slot].label + '</button>';
  }).join('');

  body.innerHTML =
    '<p class="form-section-note">Pick where your ad shows, then upload your creative.</p>' +
    '<div class="field"><label>Placement</label><div class="slot-picker" id="advertise-slot-picker">' + slotButtons + '</div></div>' +
    '<div class="field" id="advertise-package-field" hidden><label>Duration</label>' +
      '<div class="package-picker" id="advertise-package-picker"></div></div>' +
    '<div class="field" id="advertise-campaign-note" hidden></div>' +
    '<div class="field"><label id="advertise-image-label">' + ICON_CAMERA_SVG + ' Ad image</label>' +
      '<input type="file" id="advertise-image" accept="image/png,image/jpeg,image/webp"></div>' +
    '<div class="field"><label for="advertise-link">Link URL</label>' +
      '<input type="text" id="advertise-link" placeholder="https://"></div>' +
    '<button type="button" class="cta-button" id="advertise-submit" style="width:100%;justify-content:center">Continue to payment</button>' +
    '<p id="advertise-status"></p>';

  document.querySelectorAll('#advertise-slot-picker .slot-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      selectedAdSlot = btn.getAttribute('data-slot');
      document.querySelectorAll('#advertise-slot-picker .slot-option').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      renderPackagePickerForSlot(selectedAdSlot);
    });
  });

  document.getElementById('advertise-submit').addEventListener('click', async function () {
    var submitBtn = this;
    var statusEl = document.getElementById('advertise-status');
    statusEl.className = '';
    statusEl.textContent = '';
    var imageFile = document.getElementById('advertise-image').files[0];
    var linkUrl = document.getElementById('advertise-link').value.trim();
    if (!selectedAdSlot) { statusEl.className = 'error'; statusEl.textContent = 'Choose a placement.'; return; }
    if (!imageFile) { statusEl.className = 'error'; statusEl.textContent = selectedAdSlot === 'campaign_banner' ? 'Upload your logo.' : 'Choose an ad image.'; return; }
    if (!/^https?:\\/\\//i.test(linkUrl)) {
      statusEl.className = 'error';
      statusEl.textContent = 'Enter a valid link starting with http:// or https://.';
      return;
    }
    if (selectedAdSlot !== 'campaign_banner' && !selectedAdPackage) {
      statusEl.className = 'error'; statusEl.textContent = 'Choose a duration.'; return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading\\u2026';
    try {
      var formData = new FormData();
      formData.append('image', imageFile);
      formData.append('linkUrl', linkUrl);
      formData.append('slot', selectedAdSlot);
      if (selectedAdPackage) formData.append('package', selectedAdPackage);
      var createRes = await fetch('/api/ads/create', { method: 'POST', body: formData });
      var createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message || 'Could not create ad.');

      submitBtn.textContent = 'Redirecting to payment\\u2026';
      var payRes = await fetch('/api/ads/' + encodeURIComponent(createData.adId) + '/pay', { method: 'POST' });
      var payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.message || 'Could not start payment.');
      window.location.href = payData.authorizationUrl;
    } catch (err) {
      statusEl.className = 'error';
      statusEl.textContent = err.message || 'Something went wrong.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue to payment';
    }
  });
}

function openAdvertiseModal() {
  document.getElementById('advertise-modal-body').innerHTML = '<p class="loading-state">Loading&hellip;</p>';
  advertiseModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  renderAdvertiseModalBody();
}
function closeAdvertiseModal() {
  advertiseModalOverlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('open-advertise-modal').addEventListener('click', openAdvertiseModal);
document.getElementById('advertise-modal-close').addEventListener('click', closeAdvertiseModal);
advertiseModalOverlay.addEventListener('click', function (event) {
  if (event.target === advertiseModalOverlay) closeAdvertiseModal();
});

var socialUnlockModalOverlay = document.getElementById('social-unlock-modal-overlay');
var socialUnlockDaysInput = document.getElementById('social-unlock-days');
var socialUnlockPriceDisplay = document.getElementById('social-unlock-price-display');
function updateSocialUnlockPriceDisplay() {
  var days = Math.round(Number(socialUnlockDaysInput.value));
  if (!days || days < 1) {
    socialUnlockPriceDisplay.textContent = '\\u20a6' + SOCIAL_UNLOCK_PER_DAY_NAIRA.toLocaleString('en-NG') + '/day';
    return;
  }
  var total = days * SOCIAL_UNLOCK_PER_DAY_NAIRA;
  socialUnlockPriceDisplay.textContent = '\\u20a6' + total.toLocaleString('en-NG') + ' for ' + days + (days === 1 ? ' day' : ' days');
  document.querySelectorAll('#social-unlock-quick-picker .slot-option').forEach(function (b) {
    b.classList.toggle('selected', Number(b.getAttribute('data-days')) === days);
  });
}
function openSocialUnlockModal() {
  socialUnlockDaysInput.value = 1;
  updateSocialUnlockPriceDisplay();
  document.getElementById('social-unlock-status').textContent = '';
  socialUnlockModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSocialUnlockModal() {
  socialUnlockModalOverlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('submit-success-nudge-btn').addEventListener('click', function () {
  closeModal();
  openSocialUnlockModal();
});
document.getElementById('social-unlock-modal-close').addEventListener('click', closeSocialUnlockModal);
socialUnlockModalOverlay.addEventListener('click', function (event) {
  if (event.target === socialUnlockModalOverlay) closeSocialUnlockModal();
});
socialUnlockDaysInput.addEventListener('input', updateSocialUnlockPriceDisplay);
document.querySelectorAll('#social-unlock-quick-picker .slot-option').forEach(function (btn) {
  btn.addEventListener('click', function () {
    socialUnlockDaysInput.value = btn.getAttribute('data-days');
    updateSocialUnlockPriceDisplay();
  });
});
document.getElementById('social-unlock-submit').addEventListener('click', async function () {
  var submitBtn = this;
  var statusEl = document.getElementById('social-unlock-status');
  statusEl.className = '';
  statusEl.textContent = '';
  var days = Math.round(Number(socialUnlockDaysInput.value));
  if (!days || days < 1 || days > 90) { statusEl.className = 'error'; statusEl.textContent = 'Enter a number of days between 1 and 90.'; return; }
  submitBtn.disabled = true;
  submitBtn.textContent = 'Starting payment\\u2026';
  try {
    var res = await fetch('/api/social-unlock/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: days })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Could not start payment.');
    window.location.href = data.authorizationUrl;
  } catch (err) {
    statusEl.className = 'error';
    statusEl.textContent = err.message || 'Something went wrong -- try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue to payment';
  }
});

// Reused for every ad position -- each fetches/rotates completely
// independently, so the top, bottom, and profile-tab slots can each show
// a different advertiser at the same time. An empty slot (no ad running)
// stays fully hidden -- deliberately NOT replaced with any "advertise
// here" callout, so viewers never learn to subconsciously recognize that
// spot as "ad space" and tune it out once a real ad does show there.
// The one, low-key advertise CTA stays the existing footer link.
async function loadSponsoredAd(apiSlot, elementSuffix) {
  var slotEl = document.getElementById('sponsored-slot' + elementSuffix);
  if (!slotEl) return;
  try {
    var res = await fetch('/api/ads/active/' + apiSlot);
    if (!res.ok) { slotEl.hidden = true; return; }
    var data = await res.json();
    if (!data.ad) { slotEl.hidden = true; return; }
    document.getElementById('sponsored-image' + elementSuffix).src = data.ad.imageUrl;
    slotEl.href = data.ad.linkUrl;
    slotEl.hidden = false;
  } catch (err) {}
}
loadSponsoredAd('ranking_top', '');
loadSponsoredAd('ranking_bottom', '-bottom');
loadSponsoredAd('profile_tab', '-profile');
loadSponsoredAd('campaign_banner', '-campaign');

// "More games coming soon" teaser -- collapsed by default so it doesn't
// compete with the live leaderboard above it; purely a static preview,
// no fetch involved.
(function () {
  var toggle = document.getElementById('coming-soon-toggle');
  var grid = document.getElementById('coming-soon-grid');
  if (!toggle || !grid) return;
  toggle.addEventListener('click', function () {
    var expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    grid.hidden = expanded;
  });
})();

// Paystack redirects the browser back here with ?ad_confirm=<id> (plus
// its own reference/trxref params) after checkout -- confirm the payment
// server-side and clean the URL immediately so a page refresh doesn't
// re-trigger this.
(function handleAdPaymentRedirect() {
  var params = new URLSearchParams(window.location.search);
  var adConfirmId = params.get('ad_confirm');
  if (!adConfirmId) return;
  var reference = params.get('reference') || params.get('trxref') || '';
  window.history.replaceState({}, '', window.location.pathname);

  fetch('/api/ads/' + encodeURIComponent(adConfirmId) + '/confirm?reference=' + encodeURIComponent(reference))
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        alert(data.status === 'pending_review'
          ? "Payment received! Your ad is now awaiting review and will go live once approved."
          : 'Your ad payment was confirmed.');
      } else {
        alert(data.message || 'Could not confirm your ad payment.');
      }
    })
    .catch(function () {});
})();

// Same redirect-confirm shape as the ad flow above, for
// ?social_unlock_confirm=<id>. Re-fetches the profile afterward (when
// that tab happens to be open) so the "Socials showing on leaderboard"
// banner reflects the new status immediately instead of waiting for
// some unrelated re-render.
(function handleSocialUnlockPaymentRedirect() {
  var params = new URLSearchParams(window.location.search);
  var unlockConfirmId = params.get('social_unlock_confirm');
  if (!unlockConfirmId) return;
  var reference = params.get('reference') || params.get('trxref') || '';
  window.history.replaceState({}, '', window.location.pathname);

  fetch('/api/social-unlock/' + encodeURIComponent(unlockConfirmId) + '/confirm?reference=' + encodeURIComponent(reference))
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success && data.status === 'paid') {
        alert('Your socials are now showing on the leaderboard!');
      } else if (data.success) {
        alert('Payment received.');
      } else {
        alert(data.message || 'Could not confirm your payment.');
      }
      if (!document.getElementById('view-profile').hidden) renderProfile();
    })
    .catch(function () {});
})();

document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  if (!modalOverlay.hidden) closeModal();
  if (!profileEditModalOverlay.hidden) closeProfileEditModal();
  if (!authModalOverlay.hidden) closeAuthModal();
  if (!advertiseModalOverlay.hidden) closeAdvertiseModal();
  if (!socialUnlockModalOverlay.hidden) closeSocialUnlockModal();
});

document.getElementById('profile-edit-form').addEventListener('submit', async function (event) {
  event.preventDefault();
  var form = event.target;
  var button = document.getElementById('profile-edit-submit');
  var status = document.getElementById('profile-edit-status');
  status.className = ''; status.textContent = '';
  button.disabled = true;
  button.textContent = 'Saving\\u2026';
  try {
    var profileRes = await fetch('/api/account/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: document.getElementById('edit_display_name').value.trim(),
        lagosLifeHandle: document.getElementById('edit_lagos_life_handle').value.trim(),
        instagramHandle: document.getElementById('edit_instagram').value.trim(),
        tiktokHandle: document.getElementById('edit_tiktok').value.trim(),
        twitterHandle: document.getElementById('edit_twitter').value.trim(),
        snapchatHandle: document.getElementById('edit_snapchat').value.trim()
      })
    });
    var profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.message || 'Could not save profile.');

    var avatarFile = document.getElementById('edit_avatar').files[0];
    if (avatarFile) {
      var avatarForm = new FormData();
      avatarForm.append('avatar', avatarFile);
      var avatarRes = await fetch('/api/account/avatar', { method: 'POST', body: avatarForm });
      var avatarData = await avatarRes.json();
      if (!avatarRes.ok) throw new Error(avatarData.message || 'Could not save avatar.');
    }

    status.className = 'success';
    status.textContent = 'Saved!';
    await renderProfile();
    loadLeaderboard();
    setTimeout(closeProfileEditModal, 700);
  } catch (err) {
    status.className = 'error';
    status.textContent = err.message || 'Something went wrong -- try again.';
  } finally {
    button.disabled = false;
    button.textContent = 'Save profile';
  }
});

document.getElementById('submit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const button = document.getElementById('submit-button');
  const status = document.getElementById('submit-status');
  const successState = document.getElementById('submit-success-state');
  const accountFieldsVisible = !document.getElementById('submit-account-fields').hidden;
  status.className = '';
  status.textContent = '';
  button.disabled = true;
  try {
    // Not logged in yet -- create the account (or, if that email already
    // has one, log into it) before the balance submission itself, so the
    // one form/submit does both in sequence.
    if (accountFieldsVisible && !currentAccount) {
      const email = document.getElementById('submit_email').value.trim();
      const password = document.getElementById('submit_password').value;
      // Reuse the name/handle already being typed for the balance
      // submission itself -- handleSignup now requires both, same as the
      // standalone auth modal, so a created account is never left blank.
      const displayName = document.getElementById('display_name').value.trim();
      const lagosLifeHandle = document.getElementById('lagos_life_handle').value.trim();
      button.textContent = 'Creating account\u2026';
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, displayName: displayName, lagosLifeHandle: lagosLifeHandle })
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) {
        if (signupRes.status === 409) {
          button.textContent = 'Logging in\u2026';
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok) {
            throw new Error('That email is already registered. Enter the matching password, or use a different email.');
          }
          currentAccount = loginData.account;
        } else {
          throw new Error(signupData.message || 'Could not create your account.');
        }
      } else {
        currentAccount = signupData.account;
      }
    }

    button.textContent = 'Submitting\u2026';
    const reportedBalanceInput = document.getElementById('reported_balance');
    const normalizedBalance = normalizeBalanceInputValue(reportedBalanceInput.value);
    if (!normalizedBalance) {
      throw new Error('Enter a valid balance amount.');
    }
    if (normalizedBalance.length > 15) {
      throw new Error('Balance is too large. Maximum is 999,999,999,999,999.');
    }
    reportedBalanceInput.value = formatBalanceForInput(normalizedBalance);

    const formData = new FormData(form);
    // API expects a numeric string. Keep commas for UX in the field, but
    // send a clean value to the server.
    formData.set('reported_balance', normalizedBalance);
    const res = await fetch('/api/submit', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Submission failed');
    }

    saveEntry({ id: data.id });
    refreshRankChip();
    initRankingView();
    if (!document.getElementById('view-profile').hidden) renderProfile();

    // Success mode: hide the form and show just the submitted state so
    // people don't need to scroll past the form to see the next action.
    form.hidden = true;
    successState.hidden = false;

    // Skip the pitch if they already have an active unlock -- nothing to
    // sell them right after they just submitted.
    var alreadyUnlocked = currentAccount && currentAccount.socialUnlockEndsAt && currentAccount.socialUnlockEndsAt * 1000 > Date.now();
    document.getElementById('submit-success-nudge').hidden = !!alreadyUnlocked;

    form.reset();
    if (window.turnstile) window.turnstile.reset();
  } catch (err) {
    status.className = 'error';
    status.textContent = err.message || 'Something went wrong -- try again.';
  } finally {
    button.disabled = false;
    button.textContent = currentAccount ? 'Submit for review' : 'Create account & submit';
  }
});

function normalizeBalanceInputValue(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function formatBalanceForInput(rawDigits) {
  const digits = normalizeBalanceInputValue(rawDigits).replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-NG');
}

const reportedBalanceInput = document.getElementById('reported_balance');
if (reportedBalanceInput) {
  reportedBalanceInput.addEventListener('input', function () {
    this.value = formatBalanceForInput(this.value);
  });
}

// Sponsor spotlight -- shown on every page load while a campaign is
// running AND has at least one active campaign_banner sponsor.
// Deliberately NOT localStorage-gated like the welcome modal below: a
// sponsor is paying for maximum exposure, so this repeats every visit
// rather than showing once ever. /api/ads/active/campaign_banner already
// only ever returns an ad when a campaign is genuinely active (see
// getActiveAdsForSlot's own campaign-status join), so no separate
// campaign check is needed here.
function maybeShowSponsorSpotlight() {
  var overlay = document.getElementById('sponsor-spotlight-overlay');
  if (!overlay) return;
  fetch('/api/ads/active/campaign_banner').then(function (res) {
    return res.ok ? res.json() : null;
  }).then(function (data) {
    if (!data || !data.ad) return;
    document.getElementById('sponsor-spotlight-image').src = data.ad.imageUrl;
    document.getElementById('sponsor-spotlight-link').href = data.ad.linkUrl;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }).catch(function () {});
}
(function () {
  var overlay = document.getElementById('sponsor-spotlight-overlay');
  if (!overlay) return;
  function closeSponsorSpotlight() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }
  document.getElementById('sponsor-spotlight-close').addEventListener('click', closeSponsorSpotlight);
  document.getElementById('sponsor-spotlight-dismiss').addEventListener('click', closeSponsorSpotlight);
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeSponsorSpotlight();
  });
})();

// First-visit welcome modal -- shown once per browser (localStorage-gated,
// not cookie/session-gated, so it survives across tabs but not a cleared
// site data / different device). Marked seen immediately on show, not on
// dismiss, so a quick refresh mid-session doesn't flash it again.
//
// Sequenced against the sponsor spotlight above rather than shown at the
// same time -- a brand-new visitor's first-ever load can trigger both at
// once, and two stacked modals would be worse than either alone. The
// spotlight opens right after this one is DISMISSED (close/backdrop/
// "just looking"), but is deliberately skipped when the CTA sends them
// straight into the submit-balance modal instead -- they'll still see
// the spotlight on their next page view, and chaining it in front of the
// modal they just asked to open would be the exact clash to avoid.
(function () {
  var WELCOME_SEEN_KEY = 'lagoslife_welcome_seen';
  var welcomeModalOverlay = document.getElementById('welcome-modal-overlay');
  var welcomeShownNow = false;
  function closeWelcomeModal() {
    welcomeModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }
  function dismissWelcomeModal() {
    closeWelcomeModal();
    maybeShowSponsorSpotlight();
  }
  document.getElementById('welcome-modal-close').addEventListener('click', dismissWelcomeModal);
  document.getElementById('welcome-modal-dismiss').addEventListener('click', dismissWelcomeModal);
  document.getElementById('welcome-modal-cta').addEventListener('click', function () {
    closeWelcomeModal();
    openModal();
  });
  welcomeModalOverlay.addEventListener('click', function (event) {
    if (event.target === welcomeModalOverlay) dismissWelcomeModal();
  });
  try {
    if (!localStorage.getItem(WELCOME_SEEN_KEY)) {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
      welcomeModalOverlay.hidden = false;
      document.body.style.overflow = 'hidden';
      welcomeShownNow = true;
    }
  } catch (err) {
    // Fail closed (no modal) if storage is unavailable -- e.g. private
    // browsing -- rather than risk showing it on every single page load.
  }
  if (!welcomeShownNow) maybeShowSponsorSpotlight();
})();

// Header announcements popover -- open by default (not click-to-reveal),
// showing whichever of these is most relevant right now: a real admin
// announcement > "come back at the reveal time" (if this visitor has
// submitted to the currently-gated campaign) > a short nudge to submit
// (if they never have) > a plain "nothing new" placeholder. Manually
// closeable; a genuinely new, more relevant state (a fresh announcement,
// or just-unlocked reveal-wait right after submitting) re-surfaces it
// even if it had been closed. Rendered via real DOM nodes (not
// innerHTML) since announcement titles/bodies are admin-authored free
// text, not pre-sanitized markup.
var ANNOUNCEMENTS_LAST_SEEN_KEY = 'lagoslife_announcements_last_seen';
var announcementsBtn = document.getElementById('announcements-btn');
var announcementsBadge = document.getElementById('announcements-badge');
var announcementsPopover = document.getElementById('announcements-popover');
var announcementsCloseBtn = document.getElementById('announcements-popover-close');
var announcementsMessage = document.getElementById('announcements-popover-message');
var latestAnnouncements = [];
var lastPopoverKind = null;

function hasEverSubmitted() {
  return !!(currentAccount || getSavedEntry());
}

// Only ever one short message at a time now (it has to fit inside the
// cloud glyph's safe zone -- see the CSS) -- the fuller history with
// dates still lives on the dedicated /announcements page, linked below.
function renderPopoverMessage(title, body, clickable) {
  announcementsMessage.innerHTML = '';
  announcementsMessage.className = clickable ? 'announcements-popover-nudge' : '';
  var titleEl = document.createElement('div');
  titleEl.className = 'announcements-popover-title';
  titleEl.textContent = title;
  var bodyEl = document.createElement('p');
  bodyEl.className = 'announcements-popover-body';
  bodyEl.textContent = body;
  announcementsMessage.appendChild(titleEl);
  announcementsMessage.appendChild(bodyEl);
  if (clickable) {
    announcementsMessage.addEventListener('click', function () {
      announcementsPopover.hidden = true;
      openModal();
    });
  }
}

function updateAnnouncementsBadge() {
  announcementsBadge.hidden = !announcementsPopover.hidden || lastPopoverKind === 'none' || lastPopoverKind === null;
}

function closeAnnouncementsPopover() {
  announcementsPopover.hidden = true;
  updateAnnouncementsBadge();
}

// campaignStatus: the same object initRankingView already fetched from
// /api/campaign/status (or null if that hasn't resolved/errored yet) --
// reused here instead of a second fetch.
function refreshAnnouncementsPopover(campaignStatus) {
  var kind;
  if (latestAnnouncements.length > 0) {
    kind = 'announcements';
    renderPopoverMessage(latestAnnouncements[0].title, latestAnnouncements[0].body, false);
  } else if (campaignStatus && campaignStatus.active && campaignStatus.unlocked && campaignStatus.campaign && !campaignStatus.campaign.revealed) {
    kind = 'reveal-wait';
    var revealDate = new Date(campaignStatus.campaign.nextRevealAt * 1000);
    var timeLabel = revealDate.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
    renderPopoverMessage("You're entered!", 'Results reveal today at ' + timeLabel + '.', false);
  } else if (!hasEverSubmitted()) {
    kind = 'nudge';
    renderPopoverMessage('Prove it \\ud83c\\udfc6', "Think you're the best? Submit your balance.", true);
  } else {
    kind = 'none';
    renderPopoverMessage('All caught up', 'No notifications for now.', false);
  }

  if ((kind === 'reveal-wait' || kind === 'announcements') && kind !== lastPopoverKind) {
    announcementsPopover.hidden = false;
  }
  lastPopoverKind = kind;
  updateAnnouncementsBadge();
}

announcementsBtn.addEventListener('click', function (event) {
  event.stopPropagation();
  announcementsPopover.hidden = !announcementsPopover.hidden;
  if (!announcementsPopover.hidden) {
    try {
      if (latestAnnouncements[0]) localStorage.setItem(ANNOUNCEMENTS_LAST_SEEN_KEY, latestAnnouncements[0].id);
    } catch (err) {}
  }
  updateAnnouncementsBadge();
});
announcementsCloseBtn.addEventListener('click', function (event) {
  event.stopPropagation();
  closeAnnouncementsPopover();
});
document.addEventListener('click', function (event) {
  if (!announcementsPopover.hidden && !announcementsPopover.contains(event.target) && event.target !== announcementsBtn) {
    closeAnnouncementsPopover();
  }
});

(async function () {
  try {
    var res = await fetch('/api/announcements?limit=3');
    var data = await res.json();
    latestAnnouncements = data.announcements || [];
  } catch (err) {}
  refreshAnnouncementsPopover(null);
})();

// Every balance on the page shows the abbreviated form (1.2M, 5B,
// 1000T -- see formatBalanceAbbrev); tapping one reveals the exact
// amount in a small tooltip, read from that span's own data-full
// attribute. One shared tooltip element repositioned per tap, rather
// than a tooltip per balance (there can be dozens on one page).
(function () {
  var balanceTooltip = document.getElementById('balance-tooltip');
  function showBalanceTooltip(amountEl) {
    var full = amountEl.getAttribute('data-full');
    if (!full) return;
    balanceTooltip.textContent = full;
    balanceTooltip.hidden = false;
    var rect = amountEl.getBoundingClientRect();
    var tipHeight = balanceTooltip.offsetHeight;
    var showAbove = rect.top - tipHeight - 12 > 0;
    balanceTooltip.classList.toggle('tooltip-below', !showAbove);
    var left = Math.min(Math.max(rect.left + rect.width / 2, 50), window.innerWidth - 50);
    balanceTooltip.style.left = left + 'px';
    balanceTooltip.style.top = (showAbove ? rect.top - 8 : rect.bottom + 8) + 'px';
  }
  document.addEventListener('click', function (event) {
    var amountEl = event.target.closest ? event.target.closest('.balance-amount') : null;
    if (amountEl) {
      event.stopPropagation();
      showBalanceTooltip(amountEl);
      return;
    }
    balanceTooltip.hidden = true;
  });
  // A tab switch or re-render can remove the tapped balance from the
  // DOM entirely (its position would go stale) -- just hide rather than
  // try to track it.
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { balanceTooltip.hidden = true; });
  });
})();
</script>
</body>
</html>`;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}
