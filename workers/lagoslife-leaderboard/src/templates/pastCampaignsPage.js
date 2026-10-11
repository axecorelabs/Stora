// Static shell, same architecture as announcementsPage.js's
// renderAnnouncementsPage -- doesn't embed the campaign list directly
// (keeps this page's own cache TTL independent of the data's
// freshness); the list is fetched client-side from
// GET /api/campaigns/past instead.
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../assets.js';

function trophySvg(size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"/><path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>`;
}
const ICON_TROPHY = trophySvg(22);
const ICON_TROPHY_SM = trophySvg(16);
const ICON_ARROW_LEFT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
const ICON_USER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>';
// Real sourced icon (Lucide "history", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static), used for the "no past campaigns
// yet" empty state.
const ICON_HISTORY_OFF = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l2.5 2.5"/><path d="M3.05 11a9 9 0 1 0 .5-4"/><path d="M3 4v4h4"/></svg>';

var AVATAR_PALETTE = ['#c8962c', '#e0b24c', '#a87820', '#f0c868', '#8a6218', '#d9a93f'];

// Same canonical-origin reasoning as publicPage.js's own OG tags -- see
// that file's comment for why this is a deliberately hardcoded domain,
// not derived from the request.
const CANONICAL_ORIGIN = 'https://lagoslifeforbes.com.ng';
const OG_DESCRIPTION = 'Past campaigns and winners on Lagos Life Forbes.';

export function renderPastCampaignsPage(env) {
  const ogImageUrl = `${CANONICAL_ORIGIN}/og-image.jpg`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Past Campaigns -- Lagos Life Forbes</title>
<meta name="description" content="${OG_DESCRIPTION}">
<link rel="icon" href="/og-image.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="/og-image.jpg">
<meta property="og:type" content="website">
<meta property="og:title" content="Past Campaigns -- Lagos Life Forbes">
<meta property="og:description" content="${OG_DESCRIPTION}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Past Campaigns -- Lagos Life Forbes">
<meta name="twitter:description" content="${OG_DESCRIPTION}">
<meta name="twitter:image" content="${ogImageUrl}">
<style>
  :root {
    --ink: #0b3321; --ink-soft: #0f4530; --gold: #f4c542; --gold-deep: #c8962c;
    --bg: #ffffff; --surface: #f6f8f5; --border: #e4ebe3; --field-bg: #eef2ec;
    --text: #13241a; --muted: #6b7d72;
    --silver: #9aa3ab; --bronze: #b06a3a;
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
  .campaign-list { display: flex; flex-direction: column; gap: 14px; }
  .campaign-card {
    background: #fff; border: 1px solid var(--border); border-radius: 16px;
    padding: 16px 18px; box-shadow: 0 2px 14px rgba(11,51,33,0.05);
  }
  .campaign-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .campaign-card-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%; background: var(--field-bg);
    color: var(--gold-deep); flex-shrink: 0;
  }
  .campaign-card-title { font-size: 1rem; font-weight: 800; letter-spacing: -0.005em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .campaign-card-dates { font-size: 0.74rem; color: var(--muted); margin: 0 0 10px; }
  .campaign-card-reward { font-size: 0.86rem; color: var(--text); line-height: 1.5; margin: 0 0 12px; }
  .campaign-winner-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 10px 12px;
  }
  .winner-avatar, .winner-avatar-img {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: #fff; border: 2px solid var(--gold);
  }
  .winner-avatar-img { object-fit: cover; }
  .winner-info { min-width: 0; flex: 1; }
  .winner-label { font-size: 0.68rem; color: var(--gold-deep); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .winner-handle { font-size: 0.9rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .winner-balance { font-size: 0.82rem; font-weight: 700; color: var(--gold-deep); white-space: nowrap; flex-shrink: 0; }
</style>
</head>
<body>
<div class="wrap">
  <a class="back-link" href="/">${ICON_ARROW_LEFT} Back to the leaderboard</a>
  <header>
    <span class="icon-trophy">${ICON_TROPHY}</span>
    <h1>Lagos Life Forbes</h1>
  </header>
  <p class="subtitle">Past campaigns</p>
  <div id="campaigns-list">
    <p class="loading-state">Loading&hellip;</p>
  </div>
</div>
<script>
var AVATAR_PALETTE = ${JSON.stringify(AVATAR_PALETTE)};
function hashSeed(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}
function avatarColor(seed) { return AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length]; }
function formatBalance(amount) { return '\\u20a6' + Number(amount).toLocaleString('en-NG'); }
function formatDate(epochSeconds) {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
function winnerAvatarMarkup(winner) {
  if (winner.accountId && winner.hasAvatar) {
    return '<img class="winner-avatar-img" src="/avatar/' + encodeURIComponent(winner.accountId) + '" alt="">';
  }
  return '<div class="winner-avatar" style="background:' + avatarColor(winner.handle || '') + '">' + ${JSON.stringify(ICON_USER)} + '</div>';
}
async function loadPastCampaigns() {
  var container = document.getElementById('campaigns-list');
  try {
    var res = await fetch('/api/campaigns/past');
    var data = await res.json();
    var campaigns = data.campaigns || [];
    if (campaigns.length === 0) {
      container.innerHTML = '';
      var emptyState = document.createElement('div');
      emptyState.className = 'board-empty-state';
      var emptyIcon = document.createElement('span');
      emptyIcon.className = 'board-empty-icon';
      emptyIcon.innerHTML = ${JSON.stringify(ICON_HISTORY_OFF)};
      var emptyText = document.createElement('p');
      emptyText.className = 'board-empty-text';
      emptyText.textContent = 'No campaigns have wrapped up yet -- check back once one ends.';
      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyText);
      container.appendChild(emptyState);
      return;
    }
    var list = document.createElement('div');
    list.className = 'campaign-list';
    campaigns.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'campaign-card';

      var headerRow = document.createElement('div');
      headerRow.className = 'campaign-card-header';
      var iconEl = document.createElement('span');
      iconEl.className = 'campaign-card-icon';
      iconEl.innerHTML = ${JSON.stringify(ICON_TROPHY_SM)};
      headerRow.appendChild(iconEl);
      var titleEl = document.createElement('div');
      titleEl.className = 'campaign-card-title';
      titleEl.textContent = c.name;
      headerRow.appendChild(titleEl);
      card.appendChild(headerRow);

      var datesEl = document.createElement('p');
      datesEl.className = 'campaign-card-dates';
      datesEl.textContent = c.startedAt && c.endedAt
        ? (formatDate(c.startedAt) + ' \\u2013 ' + formatDate(c.endedAt))
        : (c.endedAt ? ('Ended ' + formatDate(c.endedAt)) : '');
      card.appendChild(datesEl);

      if (c.rewardDescription) {
        var rewardEl = document.createElement('p');
        rewardEl.className = 'campaign-card-reward';
        rewardEl.textContent = c.rewardDescription;
        card.appendChild(rewardEl);
      }

      if (c.winner) {
        var winnerRow = document.createElement('div');
        winnerRow.className = 'campaign-winner-row';
        winnerRow.innerHTML = winnerAvatarMarkup(c.winner);
        var infoEl = document.createElement('div');
        infoEl.className = 'winner-info';
        var labelEl = document.createElement('div');
        labelEl.className = 'winner-label';
        labelEl.textContent = 'Winner';
        var handleEl = document.createElement('div');
        handleEl.className = 'winner-handle';
        handleEl.textContent = '@' + c.winner.handle;
        infoEl.appendChild(labelEl);
        infoEl.appendChild(handleEl);
        winnerRow.appendChild(infoEl);
        var balanceEl = document.createElement('span');
        balanceEl.className = 'winner-balance';
        balanceEl.textContent = formatBalance(c.winner.reportedBalance);
        winnerRow.appendChild(balanceEl);
        card.appendChild(winnerRow);
      } else {
        var noWinnerEl = document.createElement('p');
        noWinnerEl.className = 'campaign-card-dates';
        noWinnerEl.textContent = 'No approved entries were submitted for this campaign.';
        card.appendChild(noWinnerEl);
      }

      list.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(list);
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load past campaigns right now.</p>';
  }
}
loadPastCampaigns();
</script>
</body>
</html>`;
}
