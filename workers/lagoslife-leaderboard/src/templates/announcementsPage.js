// Static shell, same architecture as publicPage.js's renderPublicPage --
// doesn't embed the announcement list directly (keeps this page's own
// cache TTL independent of the data's freshness); the list is fetched
// client-side from GET /api/announcements instead.
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../assets.js';

function trophySvg(size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"/><path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>`;
}
const ICON_TROPHY = trophySvg(22);
const ICON_ARROW_LEFT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
// Real sourced icon (Lucide "bell-off", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static), used for the "no announcements
// yet" empty state.
const ICON_BELL_OFF = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/></svg>';

// Same canonical-origin reasoning as publicPage.js's own OG tags -- see
// that file's comment for why this is a deliberately hardcoded domain,
// not derived from the request.
const CANONICAL_ORIGIN = 'https://lagoslifeforbes.com.ng';
const OG_DESCRIPTION = 'Latest announcements from Lagos Life Forbes.';

export function renderAnnouncementsPage(env) {
  const ogImageUrl = `${CANONICAL_ORIGIN}/og-image.jpg`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Announcements -- Lagos Life Forbes</title>
<meta name="description" content="${OG_DESCRIPTION}">
<link rel="icon" href="/og-image.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="/og-image.jpg">
<meta property="og:type" content="website">
<meta property="og:title" content="Announcements -- Lagos Life Forbes">
<meta property="og:description" content="${OG_DESCRIPTION}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Announcements -- Lagos Life Forbes">
<meta name="twitter:description" content="${OG_DESCRIPTION}">
<meta name="twitter:image" content="${ogImageUrl}">
<style>
  :root {
    --ink: #0b3321; --ink-soft: #0f4530; --gold: #f4c542; --gold-deep: #c8962c;
    --bg: #ffffff; --surface: #f6f8f5; --border: #e4ebe3; --field-bg: #eef2ec;
    --text: #13241a; --muted: #6b7d72;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
  }
  .wrap { max-width: 480px; margin: 0 auto; padding: 28px 16px 60px; }
  .back-link {
    display: inline-flex; align-items: center; gap: 6px; color: var(--muted);
    font-size: 0.85rem; font-weight: 700; text-decoration: none; margin-bottom: 18px;
  }
  header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; }
  header .icon-trophy { color: var(--gold-deep); flex-shrink: 0; }
  h1 { font-size: 1.25rem; margin: 0; letter-spacing: -0.01em; }
  .subtitle { text-align: center; color: var(--muted); font-size: 0.88rem; margin: 4px 0 24px; }
  .loading-state, .empty-state {
    text-align: center; color: var(--muted); font-size: 0.9rem; padding: 40px 16px;
  }
  .board-empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 40px 16px; text-align: center;
  }
  .board-empty-icon {
    display: flex; align-items: center; justify-content: center;
    width: 60px; height: 60px; border-radius: 50%; background: var(--surface);
    color: var(--muted);
  }
  .board-empty-text { color: var(--muted); font-size: 0.9rem; margin: 0; }
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
</style>
</head>
<body>
<div class="wrap">
  <a class="back-link" href="/">${ICON_ARROW_LEFT} Back to the leaderboard</a>
  <header>
    <span class="icon-trophy">${ICON_TROPHY}</span>
    <h1>Lagos Life Forbes</h1>
  </header>
  <p class="subtitle">Announcements</p>
  <div id="announcements-list">
    <p class="loading-state">Loading&hellip;</p>
  </div>
</div>
<script>
async function loadAnnouncements() {
  var container = document.getElementById('announcements-list');
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
      iconEl.innerHTML = ${JSON.stringify(ICON_BELL.replace('width="30" height="30"', 'width="15" height="15"'))};
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
loadAnnouncements();
</script>
</body>
</html>`;
}
