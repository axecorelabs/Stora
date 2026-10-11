import { escapeHtml, formatNaira } from '../html.js';

const PACKAGE_LABELS = { day: '1 day', week: '1 week', month: '1 month', campaign: 'Sponsors this campaign' };
const SLOT_LABELS = {
  ranking_top: 'Leaderboard top', ranking_bottom: 'Leaderboard bottom',
  profile_tab: 'Profile tab', campaign_banner: 'Campaign sponsor'
};

// Same hand-drawn-icon convention as src/templates/publicPage.js (no icon
// library/build step available here either) -- trophy path reused as-is
// for brand consistency between the public page's header and this sidebar.
const ICON_HOME = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
const ICON_INBOX = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
const ICON_MEGAPHONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
const ICON_TROPHY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"/><path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
// Real sourced icon (Lucide "banknote", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static), used for the ad revenue stat tile.
const ICON_BANKNOTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>';
// Real sourced icon (Lucide "at-sign", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static) -- the social-unlock revenue card.
const ICON_AT_SIGN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>';
// Real sourced icons (Lucide "users"/"log-out"/"chevron-up", ISC-licensed,
// pulled via cdn.jsdelivr.net/npm/lucide-static) -- the Admins nav item
// and the sidebar profile dropup.
const ICON_USERS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>';
// Real sourced icon (Lucide "eye", ISC-licensed, pulled via
// cdn.jsdelivr.net/npm/lucide-static) -- the campaign views stat.
const ICON_EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
// Same hand-drawn icon publicPage.js's submit form already uses for its
// screenshot upload field, reused here for sponsor logo uploads.
const ICON_CAMERA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>';
const ICON_CHEVRON_UP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';

const ROLE_LABELS = { superadmin: 'Superadmin', agent: 'Agent', investor: 'Investor' };

// roles: which admin roles see this nav item at all -- agent/investor
// each have exactly one page per the confirmed scope (that's literally
// the only thing they see on the dashboard); superadmin sees everything.
const NAV_ITEMS = [
  { key: 'overview', href: '/admin', label: 'Overview', icon: ICON_HOME, roles: ['superadmin'] },
  { key: 'submissions', href: '/admin/submissions', label: 'Submissions', icon: ICON_INBOX, roles: ['superadmin', 'agent'] },
  { key: 'ads', href: '/admin/ads', label: 'Ads', icon: ICON_MEGAPHONE, roles: ['superadmin', 'investor'] },
  { key: 'campaigns', href: '/admin/campaigns', label: 'Campaigns', icon: ICON_TROPHY, roles: ['superadmin'] },
  { key: 'announcements', href: '/admin/announcements', label: 'Announcements', icon: ICON_BELL, roles: ['superadmin'] },
  { key: 'users', href: '/admin/users', label: 'Admins', icon: ICON_USERS, roles: ['superadmin'] }
];

// Shared shell every page renders into. Sidebar becomes a horizontal top
// bar on narrow screens; the header stays sticky with a blurred backdrop
// as content scrolls underneath it. Mostly pure CSS -- the one bit of
// client JS is the profile dropup's open/close toggle below.
function renderLayout({ active, title, subtitle, badges = {}, headerActions = '', content, modal = '', script = '', adminUser }) {
  const role = adminUser?.role || 'superadmin';
  const navHtml = NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
    const badge = badges[item.key];
    const isActive = item.key === active;
    return `<a class="nav-link${isActive ? ' active' : ''}" href="${item.href}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
    </a>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} -- Lagos Life Admin</title>
<style>
  :root {
    --ink: #0b3321; --ink-soft: #0f4530; --gold: #f4c542; --gold-deep: #c8962c;
    --bg: #f5f6f8; --card: #ffffff; --border: rgba(11,51,33,0.08); --text: #1c1c1e; --muted: #6e6e73;
    --danger: #d0372a; --danger-tint: #fdeeec; --success: #248a3d; --success-tint: #e8f6ec;
    --shadow: 0 1px 2px rgba(16,24,20,0.04), 0 4px 14px rgba(16,24,20,0.05);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased;
  }
  .admin-shell { display: flex; min-height: 100vh; }

  /* -- Sidebar -- */
  .sidebar {
    width: 232px; flex-shrink: 0; background: var(--ink); color: #fff;
    display: flex; flex-direction: column; padding: 22px 14px; position: sticky; top: 0; height: 100vh;
  }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 0.98rem; color: var(--gold); margin-bottom: 26px; padding: 0 10px; letter-spacing: -0.01em; }
  .nav-link {
    display: flex; align-items: center; gap: 11px; padding: 11px 12px; border-radius: 10px;
    color: rgba(255,255,255,0.68); text-decoration: none; font-size: 0.88rem; font-weight: 600; margin-bottom: 2px;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .nav-link .nav-icon { display: flex; flex-shrink: 0; }
  .nav-link .nav-label { flex: 1; }
  .nav-link.active { background: rgba(244,197,66,0.15); color: var(--gold); }
  .nav-badge {
    background: var(--gold); color: var(--ink); font-size: 0.66rem; font-weight: 800;
    min-width: 18px; text-align: center; padding: 1px 6px; border-radius: 999px;
  }
  .nav-links { flex: 1; }

  /* -- Sidebar profile dropup -- */
  .sidebar-footer { position: relative; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; }
  .profile-trigger {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 10px;
    background: none; border: none; color: #fff; cursor: pointer; text-align: left; font-family: inherit;
  }
  .profile-trigger:hover { background: rgba(255,255,255,0.06); }
  .profile-avatar {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; background: var(--gold); color: var(--ink);
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem;
  }
  .profile-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .profile-name { font-size: 0.84rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .profile-role-label { font-size: 0.7rem; color: rgba(255,255,255,0.55); }
  .profile-chevron { flex-shrink: 0; color: rgba(255,255,255,0.5); }
  .profile-dropup {
    position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; background: #fff; color: var(--text);
    border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.18); padding: 12px 14px; z-index: 20;
  }
  .profile-dropup[hidden] { display: none; }
  .profile-dropup-email { font-size: 0.8rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .profile-dropup-role { font-size: 0.72rem; color: var(--muted); margin-top: 1px; margin-bottom: 10px; }
  .profile-dropup-logout {
    display: flex; align-items: center; gap: 7px; width: 100%; justify-content: center;
    background: var(--danger-tint); color: var(--danger); border: none; border-radius: 9px;
    padding: 8px 10px; font-size: 0.84rem; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .profile-dropup-logout:hover { opacity: 0.85; }

  /* -- Main column -- */
  .main { flex: 1; min-width: 0; }
  .page-header {
    position: sticky; top: 0; z-index: 5;
    background: rgba(245,246,248,0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    padding: 22px 36px;
  }
  .page-header h1 { font-size: 1.5rem; font-weight: 800; margin: 0; letter-spacing: -0.015em; }
  .page-header .page-subtitle { font-size: 0.86rem; color: var(--muted); margin-top: 3px; }
  .page-body { padding: 28px 36px 64px; }

  /* -- Generic surfaces -- */
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    box-shadow: var(--shadow); padding: 16px; display: flex; flex-direction: column;
  }
  .card img { width: 100%; height: 200px; object-fit: cover; border-radius: 11px; margin: 10px 0; display: block; background: var(--bg); }
  .meta { font-size: 0.85rem; color: var(--muted); margin-bottom: 4px; line-height: 1.45; }
  .meta strong { color: var(--text); font-weight: 650; }
  .meta a { color: var(--ink-soft); word-break: break-all; }
  .empty {
    color: var(--muted); font-size: 0.92rem; text-align: center;
    padding: 56px 20px; background: var(--card); border: 1px dashed var(--border); border-radius: 16px;
  }

  /* -- Card grid (submissions / ads review) -- */
  .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .actions { display: flex; gap: 8px; margin-top: auto; padding-top: 12px; }
  .actions form { flex: 1; display: flex; flex-direction: column; }
  .actions input[type="text"] {
    width: 100%; margin-bottom: 7px; padding: 9px 11px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.82rem; font-family: inherit;
  }
  .actions input[type="text"]:focus { outline: 2px solid var(--gold); outline-offset: -1px; }
  button {
    width: 100%; padding: 10px; border-radius: 10px; border: none; font-weight: 700;
    font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
    font-family: inherit; transition: opacity 0.15s ease, transform 0.1s ease;
  }
  button:active { transform: scale(0.97); }
  .approve { background: var(--success); color: #fff; }
  .reject { background: var(--danger-tint); color: var(--danger); }

  /* -- Overview stat grid -- */
  .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px; }
  /* .stat-card itself lays out as a row (icon + value/label) so a
     non-link stat tile -- e.g. Ads page's revenue tiles, which have
     nowhere to link to -- works the same way as the Overview page's
     clickable ones below, which just wrap that same content in one <a>. */
  .stat-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow);
    padding: 20px 22px; transition: transform 0.15s ease, box-shadow 0.15s ease;
    display: flex; align-items: center; gap: 14px;
  }
  .stat-card a { color: inherit; text-decoration: none; display: flex; align-items: center; gap: 14px; }
  .stat-card:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(16,24,20,0.05), 0 8px 20px rgba(16,24,20,0.07); }
  .stat-icon { width: 42px; height: 42px; border-radius: 11px; background: var(--bg); color: var(--ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stat-value { font-size: 1.65rem; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1.1; }
  .stat-label { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }

  /* -- Campaign card -- */
  .campaign-card {
    background: var(--card); border: 1px solid var(--border); border-left: 4px solid var(--gold);
    border-radius: 16px; box-shadow: var(--shadow); padding: 22px 24px; margin-bottom: 28px; max-width: 560px;
  }
  .campaign-card.resting { border-left-color: var(--border); }
  .campaign-card label { display: block; font-size: 0.8rem; color: var(--muted); margin: 14px 0 5px; font-weight: 600; }
  .campaign-card input[type="text"] {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); font-size: 0.9rem; box-sizing: border-box; font-family: inherit;
  }
  .campaign-card input[type="text"]:focus { outline: 2px solid var(--gold); outline-offset: -1px; }
  .end-campaign {
    background: none; color: var(--danger); border: 1px solid var(--danger-tint);
    padding: 8px 16px; font-size: 0.82rem; width: auto; display: inline-flex;
  }
  .end-campaign:hover { background: var(--danger-tint); }
  .start-campaign { background: var(--success); color: #fff; margin-top: 16px; }
  .sponsor-slots-heading { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
  .sponsor-slots-hint { margin: -8px 0 14px; }
  .sponsor-slot-field {
    background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
    padding: 12px 14px 2px; margin-bottom: 12px;
  }
  .sponsor-slot-label { font-size: 0.78rem; font-weight: 800; color: var(--gold-deep); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px; }
  .sponsor-slot-field label { margin-top: 10px; }

  /* -- Tables -- */
  .table-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 16px; box-shadow: var(--shadow); border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; background: var(--card); min-width: 540px; }
  th, td { text-align: left; padding: 12px 16px; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 0.66rem; letter-spacing: 0.05em; background: var(--bg); }
  tr:last-child td { border-bottom: none; }
  .status-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
  .status-pill.active { background: var(--success-tint); color: var(--success); }
  .status-pill.ended { background: var(--bg); color: var(--muted); }
  .status-pill.disabled { background: var(--danger-tint); color: var(--danger); }
  .section-heading { font-size: 1.02rem; font-weight: 800; margin: 0 0 14px; letter-spacing: -0.01em; }

  .page-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .btn-primary {
    width: auto; background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 10px;
    font-weight: 700; font-size: 0.85rem; border: none; cursor: pointer; display: inline-flex;
    align-items: center; gap: 7px; white-space: nowrap;
  }
  .btn-primary:hover { background: var(--ink-soft); }

  /* -- Active-campaign card -- */
  .campaign-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
  .campaign-name { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.015em; }
  .campaign-meta-grid {
    display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; font-size: 0.85rem;
    padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--border);
  }
  .campaign-meta-grid dt { color: var(--muted); font-weight: 600; }
  .campaign-meta-grid dd { margin: 0; color: var(--text); }
  .campaign-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .campaign-stat { background: var(--bg); border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
  .campaign-stat .campaign-stat-icon {
    width: 32px; height: 32px; border-radius: 9px; background: var(--card); color: var(--gold-deep);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .campaign-stat .stat-value { font-size: 1.1rem; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.15; }
  .campaign-stat .stat-label { font-size: 0.68rem; color: var(--muted); margin-top: 1px; }
  .campaign-card-actions { display: flex; justify-content: flex-end; margin-top: 18px; }

  /* -- Announcements -- */
  .announcement-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .announcement-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    box-shadow: var(--shadow); padding: 16px;
  }
  .announcement-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .announcement-card-title { font-size: 0.98rem; font-weight: 800; letter-spacing: -0.005em; }
  .announcement-card-body { font-size: 0.86rem; color: var(--text); line-height: 1.5; margin: 8px 0 0; white-space: pre-wrap; }

  /* -- Modal -- */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(16,24,20,0.45); display: flex;
    align-items: center; justify-content: center; padding: 20px; z-index: 50;
    backdrop-filter: blur(2px);
  }
  .modal-overlay[hidden] { display: none; }
  .modal-card { background: var(--card); width: 100%; max-width: 420px; border-radius: 18px; padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
  .image-modal-card {
    max-width: min(96vw, 1100px);
    padding: 14px;
    background: #0f1114;
  }
  .image-modal-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: min(72vh, 720px);
    border-radius: 12px;
    overflow: hidden;
    background: #090b0d;
  }
  .image-modal-stage img {
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: 84vh;
    object-fit: contain;
    display: block;
  }
  .image-modal-card .modal-header h2 { color: #f5f6f8; }
  .image-modal-card .modal-close { background: rgba(255,255,255,0.08); color: #fff; }
  .submission-preview { cursor: zoom-in; }

  /* -- Submissions list (scales better than card grid) -- */
  .submission-list { display: grid; gap: 12px; }
  .submission-row {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow);
    padding: 14px;
    display: grid;
    gap: 12px;
  }
  .submission-row-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .submission-index {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--bg);
    color: var(--ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 800;
    flex-shrink: 0;
  }
  .submission-name { font-size: 0.92rem; font-weight: 750; letter-spacing: -0.01em; }
  .submission-balance { margin-left: auto; font-size: 0.84rem; color: var(--muted); font-weight: 650; }
  .submission-row-body {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
    align-items: start;
  }
  .submission-shot {
    width: 100%;
    aspect-ratio: 16/10;
    object-fit: cover;
    border-radius: 11px;
    display: block;
    background: var(--bg);
  }
  .submission-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    align-content: start;
  }
  .submission-actions form { display: flex; flex-direction: column; }
  .submission-actions input[type="text"] {
    width: 100%; margin-bottom: 7px; padding: 9px 11px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.82rem; font-family: inherit;
  }
  .submission-actions input[type="text"]:focus { outline: 2px solid var(--gold); outline-offset: -1px; }
  .campaign-chip {
    display: inline-block; background: var(--bg); color: var(--muted); font-size: 0.72rem; font-weight: 700;
    padding: 2px 9px; border-radius: 999px; border: 1px solid var(--border);
  }
  .approved-meta { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--muted); align-content: start; }
  .submissions-toolbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .submissions-tabs { display: flex; gap: 6px; background: var(--bg); border-radius: 10px; padding: 4px; }
  .tab-link {
    padding: 7px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: var(--muted);
    text-decoration: none;
  }
  .tab-link.active { background: var(--card); color: var(--text); box-shadow: var(--shadow); }
  .campaign-filter-form select {
    padding: 8px 12px; border-radius: 9px; border: 1px solid var(--border); background: var(--card);
    color: var(--text); font-size: 0.85rem; font-family: inherit;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .modal-header h2 { font-size: 1.05rem; margin: 0; font-weight: 800; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 50%; background: var(--bg); border: none;
    color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .field-hint { font-size: 0.76rem; color: var(--muted); margin: 6px 0 10px; line-height: 1.4; }
  /* Every modal form (Create campaign, New announcement, ...) shares
     this -- there was no base styling for plain form fields at all
     outside the few places (.campaign-card, .actions) that happened to
     style their own inputs directly, so a modal's fields were rendering
     as totally unstyled browser defaults. */
  .modal-card form label { display: block; font-size: 0.8rem; color: var(--muted); margin: 14px 0 5px; font-weight: 600; }
  .modal-card form label:first-of-type { margin-top: 2px; }
  .modal-card form input[type="text"],
  .modal-card form input[type="email"],
  .modal-card form input[type="password"],
  .modal-card form input[type="time"],
  .modal-card form input[type="number"],
  .modal-card form input[type="date"],
  .modal-card form input[type="datetime-local"],
  .modal-card form select,
  .modal-card form textarea {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); font-size: 0.9rem; box-sizing: border-box; font-family: inherit;
  }
  .modal-card form textarea { resize: vertical; min-height: 80px; }
  .modal-card form input[type="text"]:focus,
  .modal-card form input[type="email"]:focus,
  .modal-card form input[type="password"]:focus,
  .modal-card form input[type="time"]:focus,
  .modal-card form input[type="number"]:focus,
  .modal-card form input[type="date"]:focus,
  .modal-card form input[type="datetime-local"]:focus,
  .modal-card form select:focus,
  .modal-card form textarea:focus {
    outline: 2px solid var(--gold); outline-offset: -1px;
  }

  /* -- Wider, internally-scrollable variant for the campaign modal (name
     + reward + sponsor slots are a lot more content than the other,
     short modals this shares .modal-card with) -- a 2-column grid above
     640px, single column (same as every other modal) below it. -- */
  .campaign-modal-card { max-width: 760px; max-height: calc(100vh - 40px); overflow-y: auto; }
  .campaign-form-grid { display: grid; grid-template-columns: 1fr; gap: 0 20px; }
  @media (min-width: 640px) {
    .campaign-form-grid { grid-template-columns: 1fr 1fr; }
  }
  .campaign-form-grid .field-full { grid-column: 1 / -1; }
  .campaign-modal-card .field { margin-bottom: 14px; }
  .duration-picker { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .duration-option, .duration-custom-tab {
    width: auto; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .duration-option.selected, .duration-custom-tab.selected { background: var(--ink); color: #fff; border-color: var(--ink); }
  .duration-custom-panel { margin-top: 10px; padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; }
  .duration-custom-panel[hidden] { display: none; }
  .duration-custom-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
  .duration-custom-tab { padding: 6px 12px; font-size: 0.78rem; }

  @media (max-width: 860px) {
    .admin-shell { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: sticky; top: 0; z-index: 10; flex-direction: row; align-items: center; padding: 10px 10px; overflow-x: auto; }
    .brand { display: none; }
    .nav-link { flex-direction: column; gap: 4px; padding: 8px 14px; white-space: nowrap; min-width: 64px; min-height: 44px; justify-content: center; }
    .nav-link .nav-label { font-size: 0.68rem; }
    .page-header { padding: 16px 18px; top: 0; }
    .page-header h1 { font-size: 1.25rem; }
    .page-body { padding: 18px 18px 48px; }
    .card-grid { grid-template-columns: 1fr; }
    .stat-row { grid-template-columns: 1fr; }
    .campaign-card { max-width: none; }
    .page-header-row { flex-direction: column; }
    .btn-primary { width: 100%; justify-content: center; }
    .campaign-stats-row { grid-template-columns: 1fr; }
    .submission-row-body { grid-template-columns: 1fr; }
    .submission-balance { margin-left: 0; width: 100%; }
    .submission-actions { grid-template-columns: 1fr; }
    .submissions-toolbar { flex-direction: column; align-items: stretch; }
    .campaign-filter-form select { width: 100%; }
    .nav-links { display: flex; flex: 1; }
    .sidebar-footer { margin-top: 0; border-top: none; padding-top: 0; flex-shrink: 0; margin-left: 4px; }
    .profile-trigger { padding: 8px; }
    .profile-info { display: none; }
    .profile-dropup { left: auto; right: 0; width: 220px; bottom: calc(100% + 10px); }
  }
</style>
</head>
<body>
<div class="admin-shell">
  <nav class="sidebar">
    <div class="brand">${ICON_TROPHY} Lagos Life Admin</div>
    <div class="nav-links">${navHtml}</div>
    ${renderSidebarProfile(adminUser)}
  </nav>
  <main class="main">
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<div class="page-subtitle">${subtitle}</div>` : ''}
        </div>
        ${headerActions ? `<div class="page-header-actions">${headerActions}</div>` : ''}
      </div>
    </div>
    <div class="page-body">
      ${content}
    </div>
  </main>
</div>
${modal}
<script>${PROFILE_DROPUP_SCRIPT}${script}</script>
</body>
</html>`;
}

function renderSidebarProfile(adminUser) {
  if (!adminUser) return '';
  const role = adminUser.role || 'superadmin';
  const displayName = adminUser.display_name || adminUser.email || 'Admin';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A';
  return `
    <div class="sidebar-footer">
      <button type="button" class="profile-trigger" id="profile-trigger">
        <span class="profile-avatar">${escapeHtml(initial)}</span>
        <span class="profile-info">
          <span class="profile-name">${escapeHtml(displayName)}</span>
          <span class="profile-role-label">${escapeHtml(ROLE_LABELS[role] || role)}</span>
        </span>
        <span class="profile-chevron">${ICON_CHEVRON_UP}</span>
      </button>
      <div class="profile-dropup" id="profile-dropup" hidden>
        <div class="profile-dropup-email">${escapeHtml(adminUser.email || '')}</div>
        <div class="profile-dropup-role">${escapeHtml(ROLE_LABELS[role] || role)}</div>
        <form method="POST" action="/api/admin/logout">
          <button type="submit" class="profile-dropup-logout">${ICON_LOGOUT} Log out</button>
        </form>
      </div>
    </div>
  `;
}

const PROFILE_DROPUP_SCRIPT = `
  var profileTrigger = document.getElementById('profile-trigger');
  var profileDropup = document.getElementById('profile-dropup');
  if (profileTrigger && profileDropup) {
    profileTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      profileDropup.hidden = !profileDropup.hidden;
    });
    document.addEventListener('click', function (e) {
      if (!profileDropup.hidden && !profileDropup.contains(e.target) && e.target !== profileTrigger) {
        profileDropup.hidden = true;
      }
    });
  }
`;

export function renderOverviewPage({ pendingEntries, pendingAds, activeCampaign, adminUser }) {
  const content = `
    <div class="stat-row">
      <div class="stat-card"><a href="/admin/submissions">
        <span class="stat-icon">${ICON_INBOX}</span>
        <span><span class="stat-value">${pendingEntries.length}</span><br><span class="stat-label">Pending submissions</span></span>
      </a></div>
      <div class="stat-card"><a href="/admin/ads">
        <span class="stat-icon">${ICON_MEGAPHONE}</span>
        <span><span class="stat-value">${pendingAds.length}</span><br><span class="stat-label">Ads awaiting review</span></span>
      </a></div>
      <div class="stat-card"><a href="/admin/campaigns">
        <span class="stat-icon">${ICON_TROPHY}</span>
        <span><span class="stat-value">${activeCampaign ? 'Active' : 'Resting'}</span><br><span class="stat-label">${activeCampaign ? escapeHtml(activeCampaign.name) : 'No active campaign'}</span></span>
      </a></div>
    </div>
    ${pendingEntries.length === 0 && pendingAds.length === 0
      ? '<p class="empty">Nothing needs review right now.</p>'
      : '<p class="empty">Use the sidebar to review what\'s waiting.</p>'}
  `;
  return renderLayout({
    active: 'overview',
    title: 'Overview',
    subtitle: 'What needs your attention right now.',
    badges: { submissions: pendingEntries.length || null, ads: pendingAds.length || null },
    content,
    adminUser
  });
}

// A per-row campaign chip is only informative when the list is NOT
// already scoped to one campaign (every row would otherwise repeat the
// same label) -- shown only for the "All campaigns" / "No campaign"
// filter states.
function campaignBadgeHtml(entry) {
  const label = entry.campaign_name ? escapeHtml(entry.campaign_name) : 'No campaign';
  return ` <span class="campaign-chip">${label}</span>`;
}

function buildCampaignFilterOptions(recentCampaigns, activeCampaignId, campaignFilter) {
  const opts = [`<option value="all"${campaignFilter === 'all' ? ' selected' : ''}>All campaigns</option>`];
  recentCampaigns.forEach((c) => {
    const tag = c.id === activeCampaignId ? ' (current)' : (c.status === 'ended' ? ' (ended)' : '');
    opts.push(`<option value="${escapeHtml(c.id)}"${campaignFilter === c.id ? ' selected' : ''}>${escapeHtml(c.name)}${tag}</option>`);
  });
  opts.push(`<option value="none"${campaignFilter === 'none' ? ' selected' : ''}>No campaign</option>`);
  return opts.join('');
}

export function renderSubmissionsPage({ entries, view, campaignFilter, recentCampaigns, activeCampaignId, pendingCount = 0, pendingAdsCount = 0, adminUser }) {
  const showBadge = campaignFilter === 'all' || campaignFilter === 'none';
  const rows = entries.length
    ? `<div class="submission-list">${entries.map((entry, index) => view === 'approved' ? renderApprovedEntryRow(entry, showBadge) : renderEntryListRow(entry, index, showBadge)).join('')}</div>`
    : `<p class="empty">No ${view === 'approved' ? 'approved' : 'pending'} submissions${campaignFilter && campaignFilter !== 'all' ? ' for this filter' : ''}.</p>`;

  const filterBar = `
    <div class="submissions-toolbar">
      <div class="submissions-tabs">
        <a class="tab-link${view === 'pending' ? ' active' : ''}" href="?view=pending&amp;campaign=${encodeURIComponent(campaignFilter)}">Pending</a>
        <a class="tab-link${view === 'approved' ? ' active' : ''}" href="?view=approved&amp;campaign=${encodeURIComponent(campaignFilter)}">Approved</a>
      </div>
      <form method="GET" class="campaign-filter-form">
        <input type="hidden" name="view" value="${view}">
        <select name="campaign" onchange="this.form.submit()">
          ${buildCampaignFilterOptions(recentCampaigns, activeCampaignId, campaignFilter)}
        </select>
      </form>
    </div>
  `;

  const modal = `
    <div class="modal-overlay" id="submission-image-modal" hidden>
      <div class="modal-card image-modal-card" role="dialog" aria-modal="true" aria-labelledby="submission-image-modal-title">
        <div class="modal-header">
          <h2 id="submission-image-modal-title">Submission screenshot</h2>
          <button type="button" class="modal-close" id="submission-image-modal-close" aria-label="Close">${ICON_X}</button>
        </div>
        <div class="image-modal-stage">
          <img id="submission-image-modal-preview" src="" alt="Submission screenshot preview">
        </div>
      </div>
    </div>
  `;

  const script = `
    var submissionImageModal = document.getElementById('submission-image-modal');
    var submissionImageModalPreview = document.getElementById('submission-image-modal-preview');
    var submissionImageModalClose = document.getElementById('submission-image-modal-close');

    function openSubmissionImageModal(src) {
      if (!src) return;
      submissionImageModalPreview.src = src;
      submissionImageModal.hidden = false;
      submissionImageModalClose.focus();
    }

    function closeSubmissionImageModal() {
      submissionImageModal.hidden = true;
      submissionImageModalPreview.src = '';
    }

    document.querySelectorAll('.submission-preview').forEach(function (img) {
      img.addEventListener('click', function () {
        openSubmissionImageModal(img.currentSrc || img.src);
      });
    });

    submissionImageModalClose.addEventListener('click', closeSubmissionImageModal);
    submissionImageModal.addEventListener('click', function (e) {
      if (e.target === submissionImageModal) closeSubmissionImageModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !submissionImageModal.hidden) closeSubmissionImageModal();
    });
  `;

  return renderLayout({
    active: 'submissions',
    title: 'Submissions',
    subtitle: view === 'approved' ? `${entries.length} approved` : `${pendingCount} waiting for review`,
    badges: { submissions: pendingCount || null, ads: pendingAdsCount || null },
    content: filterBar + rows,
    modal,
    script,
    adminUser
  });
}

export function renderAdsPage(pendingAds, pendingEntriesCount = 0, revenueBySlot = [], socialUnlockRevenue = { n: 0, totalKobo: 0 }, adminUser) {
  const isInvestor = adminUser?.role === 'investor';
  const totalKobo = revenueBySlot.reduce((sum, row) => sum + (row.total_kobo || 0), 0);
  const totalSold = revenueBySlot.reduce((sum, row) => sum + (row.n || 0), 0);

  const revenueRow = `
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-icon">${ICON_BANKNOTE}</span>
        <span><span class="stat-value">${formatNaira(totalKobo / 100)}</span><br><span class="stat-label">Total ad revenue</span></span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">${ICON_MEGAPHONE}</span>
        <span><span class="stat-value">${totalSold}</span><br><span class="stat-label">Ads sold (paid)</span></span>
      </div>
    </div>
    ${revenueBySlot.length ? `<div class="table-scroll"><table>
      <thead><tr><th>Placement</th><th>Ads sold</th><th>Revenue</th></tr></thead>
      <tbody>${revenueBySlot
        .slice()
        .sort((a, b) => (b.total_kobo || 0) - (a.total_kobo || 0))
        .map((row) => `<tr>
          <td>${escapeHtml(SLOT_LABELS[row.slot] || row.slot)}</td>
          <td>${row.n}</td>
          <td>${formatNaira((row.total_kobo || 0) / 100)}</td>
        </tr>`)
        .join('')}</tbody>
    </table></div>` : ''}
    <h2 class="section-heading">Social unlocks</h2>
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-icon">${ICON_AT_SIGN}</span>
        <span><span class="stat-value">${formatNaira((socialUnlockRevenue.totalKobo || 0) / 100)}</span><br><span class="stat-label">Social unlock revenue</span></span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">${ICON_CHECK}</span>
        <span><span class="stat-value">${socialUnlockRevenue.n || 0}</span><br><span class="stat-label">Unlocks purchased (paid)</span></span>
      </div>
    </div>
  `;

  // investor is revenue-only, read-only -- no pending-review queue/
  // actions, and no badge counts for actions they can't take either.
  if (isInvestor) {
    return renderLayout({
      active: 'ads',
      title: 'Revenue',
      subtitle: 'Ad and social-unlock revenue (read-only)',
      content: revenueRow,
      adminUser
    });
  }

  const rows = pendingAds.length
    ? `<div class="card-grid">${pendingAds.map(renderAdCard).join('')}</div>`
    : '<p class="empty">No ads awaiting review.</p>';
  return renderLayout({
    active: 'ads',
    title: 'Ads',
    subtitle: `${pendingAds.length} awaiting review`,
    badges: { submissions: pendingEntriesCount || null, ads: pendingAds.length || null },
    content: revenueRow + '<h2 class="section-heading">Awaiting review</h2>' + rows,
    adminUser
  });
}

export function renderCampaignsPage({ activeCampaign, activeViews = null, recentCampaigns, entryCount = 0, topEntry = null, pendingEntriesCount = 0, pendingAdsCount = 0, adminUser }) {
  const historyRows = recentCampaigns.length ? recentCampaigns.map(renderCampaignHistoryRow).join('') : '';
  const historyTable = recentCampaigns.length
    ? `<div class="table-scroll"><table>
        <thead><tr><th>Name</th><th>Status</th><th>Views</th><th>Participants</th><th>Started</th><th>Ended</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table></div>`
    : '<p class="empty">No campaigns yet.</p>';

  const content = `
    ${renderCampaignCard(activeCampaign, entryCount, topEntry, activeViews)}
    <h2 class="section-heading">History</h2>
    ${historyTable}
  `;

  const headerActions = activeCampaign
    ? ''
    : `<button type="button" class="btn-primary" id="open-campaign-modal">${ICON_PLUS} Create campaign</button>`;

  const modal = activeCampaign ? '' : `
    <div class="modal-overlay" id="campaign-modal-overlay" hidden>
      <div class="modal-card campaign-modal-card" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title">
        <div class="modal-header">
          <h2 id="campaign-modal-title">Create campaign</h2>
          <button type="button" class="modal-close" id="campaign-modal-close" aria-label="Close">${ICON_X}</button>
        </div>
        <form method="POST" action="/api/admin/campaigns/start" enctype="multipart/form-data">
          <div class="campaign-form-grid">
            <div class="field">
              <label for="campaign-name">Campaign name</label>
              <input type="text" id="campaign-name" name="name" placeholder="e.g. October Richest Sim Challenge" required>
            </div>
            <div class="field">
              <label for="campaign-reward">Reward (optional, shown on the page)</label>
              <input type="text" id="campaign-reward" name="rewardDescription" placeholder="e.g. ₦50,000 cash prize">
            </div>
          </div>

          <div class="field field-full">
            <label>Runs for</label>
            <div class="duration-picker" id="duration-picker">
              <button type="button" class="duration-option" data-seconds="3600">1 hour</button>
              <button type="button" class="duration-option" data-seconds="7200">2 hours</button>
              <button type="button" class="duration-option" data-seconds="10800">3 hours</button>
              <button type="button" class="duration-option" data-seconds="21600">6 hours</button>
              <button type="button" class="duration-option" data-seconds="43200">12 hours</button>
              <button type="button" class="duration-option selected" data-seconds="86400">24 hours</button>
              <button type="button" class="duration-option" data-seconds="172800">2 days</button>
              <button type="button" class="duration-option" data-seconds="259200">3 days</button>
              <button type="button" class="duration-option" data-seconds="604800">7 days</button>
              <button type="button" class="duration-option" data-seconds="">No end date</button>
              <button type="button" class="duration-option" id="duration-custom-btn">Custom&hellip;</button>
            </div>
            <div class="duration-custom-panel" id="duration-custom-panel" hidden>
              <div class="duration-custom-tabs">
                <button type="button" class="duration-custom-tab selected" data-mode="datetime">Specific date &amp; time</button>
                <button type="button" class="duration-custom-tab" data-mode="today">Today, at a time</button>
              </div>
              <input type="datetime-local" id="duration-custom-datetime">
              <input type="time" id="duration-custom-time" hidden>
            </div>
            <p class="field-hint" id="duration-preview">Runs for 24h.</p>
            <input type="hidden" id="campaign-duration" name="durationSeconds" value="86400">
          </div>

          <div class="field field-full">
            <label>Results reveal</label>
            <div class="duration-picker" id="reveal-mode-picker">
              <button type="button" class="duration-option selected" data-mode="immediate">Immediately on submit</button>
              <button type="button" class="duration-option" data-mode="daily">Daily reveal schedule</button>
              <button type="button" class="duration-option" data-mode="end">Only when campaign ends</button>
            </div>
            <input type="hidden" id="reveal-mode-value" name="revealMode" value="immediate">
            <div class="duration-custom-panel" id="reveal-daily-panel" hidden>
              <div class="campaign-form-grid">
                <div class="field">
                  <label for="campaign-reveal-time">Reveal results daily at (Lagos time)</label>
                  <input type="time" id="campaign-reveal-time" name="revealTime">
                </div>
                <div class="field">
                  <label for="campaign-close-time">Close again at (optional)</label>
                  <input type="time" id="campaign-close-time" name="closeTime">
                </div>
              </div>
            </div>
            <p class="field-hint" id="reveal-mode-hint">Results unlock the moment someone submits -- no embargo at all.</p>
          </div>

          <h3 class="section-heading sponsor-slots-heading">Sponsors (optional)</h3>
          <p class="field-hint sponsor-slots-hint">Book sponsors directly, before the campaign even starts -- any slot filled in here goes live the moment this campaign starts, no payment flow needed. Leave any slot blank to sell it later the normal way.</p>
          <div class="campaign-form-grid">
            ${[1, 2, 3, 4].map((i) => `
              <div class="sponsor-slot-field">
                <div class="sponsor-slot-label">Sponsor ${i}</div>
                <label for="sponsor-logo-${i}">${ICON_CAMERA} Logo</label>
                <input type="file" id="sponsor-logo-${i}" name="sponsorLogo${i}" accept="image/png,image/jpeg,image/webp">
                <label for="sponsor-link-${i}">Link URL</label>
                <input type="text" id="sponsor-link-${i}" name="sponsorLink${i}" placeholder="https://sponsor-site.com">
                <label for="sponsor-amount-${i}">Amount paid (₦, optional -- defaults to the standard price)</label>
                <input type="number" id="sponsor-amount-${i}" name="sponsorAmount${i}" min="0" step="1" placeholder="e.g. 150000">
              </div>
            `).join('')}
          </div>

          <button type="submit" class="start-campaign">${ICON_TROPHY} Start campaign</button>
        </form>
      </div>
    </div>
  `;

  const script = activeCampaign ? '' : `
    var campaignModalOverlay = document.getElementById('campaign-modal-overlay');
    var openBtn = document.getElementById('open-campaign-modal');
    var closeBtn = document.getElementById('campaign-modal-close');
    function openCampaignModal() { campaignModalOverlay.hidden = false; document.getElementById('campaign-name').focus(); }
    function closeCampaignModal() { campaignModalOverlay.hidden = true; }
    openBtn.addEventListener('click', openCampaignModal);
    closeBtn.addEventListener('click', closeCampaignModal);
    campaignModalOverlay.addEventListener('click', function (e) { if (e.target === campaignModalOverlay) closeCampaignModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !campaignModalOverlay.hidden) closeCampaignModal(); });

    // -- Duration picker: quick pills, "No end date", or a custom panel
    // (an exact date+time, or just a time for a same-day end) -- all of
    // them ultimately just compute a plain seconds-from-now value into
    // the one hidden durationSeconds field the backend already expects,
    // so nothing server-side needed to change for this.
    var durationPicker = document.getElementById('duration-picker');
    if (durationPicker) {
      var durationOptions = durationPicker.querySelectorAll('.duration-option');
      var durationHidden = document.getElementById('campaign-duration');
      var durationPreview = document.getElementById('duration-preview');
      var customBtn = document.getElementById('duration-custom-btn');
      var customPanel = document.getElementById('duration-custom-panel');
      var customDatetime = document.getElementById('duration-custom-datetime');
      var customTime = document.getElementById('duration-custom-time');
      var customTabs = customPanel.querySelectorAll('.duration-custom-tab');
      var customMode = 'datetime';

      function formatDurationPreview(seconds) {
        if (seconds === null) return 'No end date -- ends only when you stop it manually.';
        if (!isFinite(seconds) || seconds < 3600) return 'Pick a time at least 1 hour from now.';
        if (seconds > 7776000) return "That's further out than 90 days -- pick something closer.";
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var parts = [];
        if (days) parts.push(days + 'd');
        if (hours) parts.push(hours + 'h');
        if (minutes && !days) parts.push(minutes + 'm');
        return 'Runs for ' + (parts.join(' ') || '< 1m') + '.';
      }
      function setDuration(seconds) {
        durationHidden.value = seconds === null ? '' : String(seconds);
        durationPreview.textContent = formatDurationPreview(seconds);
      }
      durationOptions.forEach(function (btn) {
        btn.addEventListener('click', function () {
          durationOptions.forEach(function (b) { b.classList.remove('selected'); });
          customBtn.classList.remove('selected');
          btn.classList.add('selected');
          customPanel.hidden = true;
          var raw = btn.getAttribute('data-seconds');
          setDuration(raw === '' ? null : Number(raw));
        });
      });
      function recomputeCustom() {
        var target;
        if (customMode === 'datetime') {
          if (!customDatetime.value) { durationPreview.textContent = 'Pick a date and time.'; return; }
          target = new Date(customDatetime.value).getTime();
        } else {
          if (!customTime.value) { durationPreview.textContent = 'Pick a time.'; return; }
          var parts = customTime.value.split(':');
          var d = new Date();
          d.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
          target = d.getTime();
        }
        setDuration(Math.round((target - Date.now()) / 1000));
      }
      customBtn.addEventListener('click', function () {
        durationOptions.forEach(function (b) { b.classList.remove('selected'); });
        customBtn.classList.add('selected');
        customPanel.hidden = false;
        (customMode === 'datetime' ? customDatetime : customTime).focus();
        recomputeCustom();
      });
      customTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          customTabs.forEach(function (t) { t.classList.remove('selected'); });
          tab.classList.add('selected');
          customMode = tab.getAttribute('data-mode');
          customDatetime.hidden = customMode !== 'datetime';
          customTime.hidden = customMode !== 'today';
          recomputeCustom();
        });
      });
      customDatetime.addEventListener('input', recomputeCustom);
      customTime.addEventListener('input', recomputeCustom);
    }

    // -- Reveal mode: three mutually exclusive options, same pill
    // pattern as the duration picker above. "Daily reveal schedule" is
    // the only one needing the existing time fields -- enforced
    // server-side too (handleAdminStartCampaign ignores stray
    // revealTime/closeTime values whenever revealMode isn't 'daily').
    var revealModePicker = document.getElementById('reveal-mode-picker');
    if (revealModePicker) {
      var revealModeOptions = revealModePicker.querySelectorAll('.duration-option');
      var revealModeValue = document.getElementById('reveal-mode-value');
      var revealDailyPanel = document.getElementById('reveal-daily-panel');
      var revealModeHint = document.getElementById('reveal-mode-hint');
      var revealHints = {
        immediate: 'Results unlock the moment someone submits -- no embargo at all.',
        daily: 'Everyone sees nothing until the time you set below, each day.',
        end: 'Results stay completely hidden for the whole campaign -- no daily reveal, no sneak peek. Everyone finds out together when it ends.'
      };
      revealModeOptions.forEach(function (btn) {
        btn.addEventListener('click', function () {
          revealModeOptions.forEach(function (b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
          var mode = btn.getAttribute('data-mode');
          revealModeValue.value = mode;
          revealDailyPanel.hidden = mode !== 'daily';
          revealModeHint.textContent = revealHints[mode] || '';
        });
      });
    }
  `;

  return renderLayout({
    active: 'campaigns',
    title: 'Campaigns',
    subtitle: activeCampaign ? `${escapeHtml(activeCampaign.name)} is live` : 'No campaign running',
    badges: { submissions: pendingEntriesCount || null, ads: pendingAdsCount || null },
    headerActions,
    content,
    modal,
    script,
    adminUser
  });
}

function renderAnnouncementCard(announcement) {
  return `<div class="announcement-card">
    <div class="announcement-card-header">
      <div class="announcement-card-title">${escapeHtml(announcement.title)}</div>
      <form method="POST" action="/api/admin/announcements/delete" onsubmit="return confirm('Delete this announcement? This can\\'t be undone.');">
        <input type="hidden" name="id" value="${escapeHtml(announcement.id)}">
        <button type="submit" class="icon-button" aria-label="Delete">${ICON_X}</button>
      </form>
    </div>
    <div class="meta">${new Date(announcement.created_at * 1000).toLocaleString('en-NG')}</div>
    <p class="announcement-card-body">${escapeHtml(announcement.body)}</p>
  </div>`;
}

export function renderAdminAnnouncementsPage({ announcements, pendingEntriesCount = 0, pendingAdsCount = 0, adminUser }) {
  const list = announcements.length
    ? `<div class="announcement-list">${announcements.map(renderAnnouncementCard).join('')}</div>`
    : '<p class="empty">No announcements yet.</p>';

  const headerActions = `<button type="button" class="btn-primary" id="open-announcement-modal">${ICON_PLUS} New announcement</button>`;

  const modal = `
    <div class="modal-overlay" id="announcement-modal-overlay" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
        <div class="modal-header">
          <h2 id="announcement-modal-title">New announcement</h2>
          <button type="button" class="modal-close" id="announcement-modal-close" aria-label="Close">${ICON_X}</button>
        </div>
        <form method="POST" action="/api/admin/announcements/create">
          <label for="announcement-title">Title</label>
          <input type="text" id="announcement-title" name="title" maxlength="120" placeholder="e.g. New campaign just launched!" required>
          <label for="announcement-body">Message</label>
          <textarea id="announcement-body" name="body" maxlength="2000" rows="4" placeholder="What's going on?" required></textarea>
          <button type="submit" class="start-campaign">${ICON_BELL} Post announcement</button>
        </form>
      </div>
    </div>
  `;

  const script = `
    var announcementModalOverlay = document.getElementById('announcement-modal-overlay');
    var openBtn = document.getElementById('open-announcement-modal');
    var closeBtn = document.getElementById('announcement-modal-close');
    function openAnnouncementModal() { announcementModalOverlay.hidden = false; document.getElementById('announcement-title').focus(); }
    function closeAnnouncementModal() { announcementModalOverlay.hidden = true; }
    openBtn.addEventListener('click', openAnnouncementModal);
    closeBtn.addEventListener('click', closeAnnouncementModal);
    announcementModalOverlay.addEventListener('click', function (e) { if (e.target === announcementModalOverlay) closeAnnouncementModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !announcementModalOverlay.hidden) closeAnnouncementModal(); });
  `;

  return renderLayout({
    active: 'announcements',
    title: 'Announcements',
    subtitle: announcements.length ? `${announcements.length} posted` : 'Nothing posted yet',
    badges: { submissions: pendingEntriesCount || null, ads: pendingAdsCount || null },
    headerActions,
    content: list,
    modal,
    script,
    adminUser
  });
}

function formatElapsed(startedAtSeconds) {
  const seconds = Math.floor(Date.now() / 1000) - startedAtSeconds;
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return days === 1 ? '1 day running' : `${days} days running`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return hours === 1 ? '1 hour running' : `${hours} hours running`;
  return 'Just started';
}

// Scheduled end is checked/applied lazily (getActiveCampaign) rather
// than by a cron job, so this can render a few seconds of "0m left" on
// an already-ended campaign right before the next status check flips
// it -- harmless, self-corrects on the next page load.
function formatRemaining(endsAtSeconds) {
  const seconds = endsAtSeconds - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return 'Ending now';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days >= 1) return `${days}d ${hours}h left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

// Lagos (WAT, UTC+1) has no DST, so this is just a fixed offset from
// the UTC epoch -- mirrors index.js's isCampaignRevealedNow/lagosSecondsOfDay.
function formatTimeOfDay(secondsOfDay) {
  const hh = String(Math.floor(secondsOfDay / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secondsOfDay % 3600) / 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatRevealStatus(revealSecondsOfDay, closeSecondsOfDay, revealAtEnd) {
  if (revealAtEnd) return 'Results withheld completely -- reveal only when this campaign ends';
  if (revealSecondsOfDay == null) return 'Results shown immediately on submission';
  const nowLagosSeconds = ((Math.floor(Date.now() / 1000) + 3600) % 86400 + 86400) % 86400;
  const windowLabel = closeSecondsOfDay != null
    ? `daily ${formatTimeOfDay(revealSecondsOfDay)}-${formatTimeOfDay(closeSecondsOfDay)} WAT`
    : `daily from ${formatTimeOfDay(revealSecondsOfDay)} WAT`;
  let state;
  if (nowLagosSeconds < revealSecondsOfDay) {
    state = 'holding back until then';
  } else if (closeSecondsOfDay != null && nowLagosSeconds >= closeSecondsOfDay) {
    state = 'window closed for today';
  } else {
    state = 'revealed right now';
  }
  return `Results reveal ${windowLabel} -- ${state}`;
}

function renderCampaignCard(campaign, entryCount, topEntry, views) {
  if (campaign) {
    const endsLine = campaign.ends_at
      ? `${new Date(campaign.ends_at * 1000).toLocaleString('en-NG')} &middot; ${formatRemaining(campaign.ends_at)}`
      : 'No end date -- stops only when manually ended';
    return `<div class="campaign-card">
      <div class="campaign-card-header">
        <div class="campaign-name">${escapeHtml(campaign.name)}</div>
        <span class="status-pill active">Active</span>
      </div>
      <dl class="campaign-meta-grid">
        <dt>Started</dt><dd>${new Date(campaign.started_at * 1000).toLocaleDateString('en-NG')} &middot; ${formatElapsed(campaign.started_at)}</dd>
        <dt>Ends</dt><dd>${endsLine}</dd>
        <dt>Reveal</dt><dd>${formatRevealStatus(campaign.reveal_seconds_of_day, campaign.close_seconds_of_day, campaign.reveal_at_end)}</dd>
        ${campaign.reward_description ? `<dt>Reward</dt><dd>${escapeHtml(campaign.reward_description)}</dd>` : ''}
      </dl>
      <div class="campaign-stats-row">
        <div class="campaign-stat">
          <span class="campaign-stat-icon">${ICON_EYE}</span>
          <span><span class="stat-value">${views != null ? views.toLocaleString('en-NG') : '&mdash;'}</span><br><span class="stat-label">Views</span></span>
        </div>
        <div class="campaign-stat">
          <span class="campaign-stat-icon">${ICON_USERS}</span>
          <span><span class="stat-value">${entryCount}</span><br><span class="stat-label">Participants</span></span>
        </div>
        <div class="campaign-stat">
          <span class="campaign-stat-icon">${ICON_TROPHY}</span>
          <span><span class="stat-value">${topEntry ? formatNaira(topEntry.reported_balance) : '&mdash;'}</span><br><span class="stat-label">${topEntry ? `Leading: @${escapeHtml(topEntry.lagos_life_handle)}` : 'No entries yet'}</span></span>
        </div>
      </div>
      <div class="campaign-card-actions">
        <form method="POST" action="/api/admin/campaigns/end" onsubmit="return confirm('End the current campaign? This can\\'t be undone.');">
          <button type="submit" class="end-campaign">${ICON_X} End campaign</button>
        </form>
      </div>
    </div>`;
  }
  return `<div class="campaign-card resting">
    <div class="meta">No active campaign right now -- the leaderboard is open to everyone.</div>
  </div>`;
}

function renderCampaignHistoryRow(campaign) {
  const started = new Date(campaign.started_at * 1000).toLocaleDateString('en-NG');
  const ended = campaign.ended_at ? new Date(campaign.ended_at * 1000).toLocaleDateString('en-NG') : '&mdash;';
  return `<tr>
    <td>${escapeHtml(campaign.name)}</td>
    <td><span class="status-pill ${campaign.status}">${campaign.status}</span></td>
    <td>${campaign.views != null ? campaign.views.toLocaleString('en-NG') : '&mdash;'}</td>
    <td>${campaign.entry_count}</td>
    <td>${started}</td>
    <td>${ended}</td>
  </tr>`;
}

function renderEntryListRow(entry, index, showBadge) {
  return `<div class="submission-row">
    <div class="submission-row-head">
      <span class="submission-index">${index + 1}</span>
      <div class="submission-name">${escapeHtml(entry.display_name)} &middot; @${escapeHtml(entry.lagos_life_handle)}${showBadge ? campaignBadgeHtml(entry) : ''}</div>
      <div class="submission-balance">Claims: ${formatNaira(entry.reported_balance)}</div>
    </div>
    <div class="submission-row-body">
      <img class="submission-preview submission-shot" src="/admin/screenshot/${encodeURIComponent(entry.id)}" alt="submitted screenshot" title="Click to expand">
      <div class="submission-actions">
        <form method="POST" action="/api/admin/review">
          <input type="hidden" name="id" value="${escapeHtml(entry.id)}">
          <input type="hidden" name="action" value="approve">
          <button type="submit" class="approve">${ICON_CHECK} Approve</button>
        </form>
        <form method="POST" action="/api/admin/review">
          <input type="hidden" name="id" value="${escapeHtml(entry.id)}">
          <input type="hidden" name="action" value="reject">
          <input type="text" name="reason" placeholder="Reason (optional)">
          <button type="submit" class="reject">${ICON_X} Reject</button>
        </form>
      </div>
    </div>
  </div>`;
}

// Read-only -- no approve/reject actions, since this entry already went
// through review. Shows who approved it and when instead.
function renderApprovedEntryRow(entry, showBadge) {
  return `<div class="submission-row">
    <div class="submission-row-head">
      <div class="submission-name">${escapeHtml(entry.display_name)} &middot; @${escapeHtml(entry.lagos_life_handle)}${showBadge ? campaignBadgeHtml(entry) : ''}</div>
      <div class="submission-balance">Claims: ${formatNaira(entry.reported_balance)}</div>
    </div>
    <div class="submission-row-body">
      <img class="submission-preview submission-shot" src="/admin/screenshot/${encodeURIComponent(entry.id)}" alt="submitted screenshot" title="Click to expand">
      <div class="approved-meta">
        <span>Approved by ${escapeHtml(entry.reviewed_by || 'unknown')}</span>
        <span>${entry.reviewed_at ? new Date(entry.reviewed_at * 1000).toLocaleString('en-NG') : ''}</span>
      </div>
    </div>
  </div>`;
}

// -- Login / one-time setup -- standalone (no sidebar; no admin session
// exists yet by definition), sharing one small card-on-a-plain-background
// shell rather than duplicating the same ~20 lines of CSS twice.
function renderAuthCardPage({ title, heading, note = '', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} -- Lagos Life Admin</title>
<style>
  :root {
    --ink: #0b3321; --gold: #f4c542; --gold-deep: #c8962c; --bg: #f5f6f8; --card: #ffffff;
    --border: rgba(11,51,33,0.08); --text: #1c1c1e; --muted: #6e6e73; --danger: #d0372a; --danger-tint: #fdeeec;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    padding: 20px; color: var(--text);
  }
  .auth-card {
    width: 100%; max-width: 360px; background: var(--card); border: 1px solid var(--border);
    border-radius: 16px; padding: 32px 28px;
    box-shadow: 0 1px 2px rgba(16,24,20,0.04), 0 4px 14px rgba(16,24,20,0.05);
  }
  .auth-brand { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 1.02rem; color: var(--ink); margin-bottom: 22px; }
  .auth-brand .icon { color: var(--gold-deep); display: flex; }
  h1 { font-size: 1.1rem; margin: 0 0 6px; }
  .auth-note { font-size: 0.82rem; color: var(--muted); margin: 0 0 18px; line-height: 1.45; }
  .auth-error { background: var(--danger-tint); color: var(--danger); font-size: 0.84rem; font-weight: 600; padding: 10px 12px; border-radius: 10px; margin-bottom: 16px; }
  label { display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 6px; }
  input {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg); font-size: 0.9rem; margin-bottom: 16px; font-family: inherit; box-sizing: border-box;
  }
  input:focus { outline: 2px solid var(--gold); outline-offset: -1px; }
  button {
    width: 100%; padding: 11px; border-radius: 10px; border: none; background: var(--ink);
    color: #fff; font-weight: 700; font-size: 0.9rem; cursor: pointer; font-family: inherit;
  }
  button:hover { opacity: 0.9; }
</style>
</head>
<body>
  <div class="auth-card">
    <div class="auth-brand"><span class="icon">${ICON_TROPHY}</span> Lagos Life Admin</div>
    <h1>${escapeHtml(heading)}</h1>
    ${note ? `<p class="auth-note">${note}</p>` : ''}
    ${body}
  </div>
</body>
</html>`;
}

export function renderAdminLoginPage({ error = false } = {}) {
  return renderAuthCardPage({
    title: 'Admin Login',
    heading: 'Sign in',
    body: `
      ${error ? '<div class="auth-error">Incorrect email or password.</div>' : ''}
      <form method="POST" action="/api/admin/login">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
        <button type="submit">Sign in</button>
      </form>
    `
  });
}

export function renderAdminSetupPage() {
  return renderAuthCardPage({
    title: 'Admin Setup',
    heading: 'Create the first admin account',
    note: 'One-time setup -- this creates your superadmin account and only works while no admin accounts exist yet.',
    body: `
      <form method="POST" action="/api/admin/setup">
        <label for="displayName">Your name</label>
        <input type="text" id="displayName" name="displayName" maxlength="60" required>
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" minlength="8" autocomplete="new-password" required>
        <button type="submit">Create account</button>
      </form>
    `
  });
}

function renderAdminUserRow(admin, viewerId) {
  const isSelf = admin.id === viewerId;
  const isDisabled = !!admin.disabled_at;
  const roleCell = isSelf
    ? escapeHtml(ROLE_LABELS[admin.role] || admin.role)
    : `<form method="POST" action="/api/admin/users/change-role">
        <input type="hidden" name="id" value="${escapeHtml(admin.id)}">
        <select name="role" onchange="this.form.submit()" style="padding:5px 8px;font-size:0.78rem;border-radius:7px;border:1px solid var(--border);background:var(--card);font-family:inherit;">
          <option value="agent"${admin.role === 'agent' ? ' selected' : ''}>Agent</option>
          <option value="investor"${admin.role === 'investor' ? ' selected' : ''}>Investor</option>
          <option value="superadmin"${admin.role === 'superadmin' ? ' selected' : ''}>Superadmin</option>
        </select>
      </form>`;
  return `<tr>
    <td>${escapeHtml(admin.display_name)}${isSelf ? ' <span style="color:var(--muted);font-size:0.74rem;">(you)</span>' : ''}</td>
    <td>${escapeHtml(admin.email)}</td>
    <td>${roleCell}</td>
    <td><span class="status-pill ${isDisabled ? 'disabled' : 'active'}">${isDisabled ? 'Disabled' : 'Active'}</span></td>
    <td style="display:flex;gap:6px;flex-wrap:wrap;">
      <button type="button" class="reset-password-btn" data-id="${escapeHtml(admin.id)}" data-name="${escapeHtml(admin.display_name)}" style="padding:6px 12px;font-size:0.78rem;border-radius:8px;border:1px solid var(--border);background:var(--card);cursor:pointer;font-family:inherit;">Reset password</button>
      ${isSelf ? '' : `<form method="POST" action="/api/admin/users/toggle">
        <input type="hidden" name="id" value="${escapeHtml(admin.id)}">
        <input type="hidden" name="disable" value="${isDisabled ? '0' : '1'}">
        <button type="submit" class="${isDisabled ? 'approve' : 'reject'}" style="padding:6px 12px;font-size:0.78rem;">${isDisabled ? 'Enable' : 'Disable'}</button>
      </form>
      <form method="POST" action="/api/admin/users/delete" onsubmit="return confirm('Permanently delete ${escapeHtml(admin.display_name).replace(/'/g, "\\'")}? This cannot be undone.');">
        <input type="hidden" name="id" value="${escapeHtml(admin.id)}">
        <button type="submit" class="reject" style="padding:6px 12px;font-size:0.78rem;">Delete</button>
      </form>`}
    </td>
  </tr>`;
}

export function renderAdminUsersPage({ admins, pendingEntriesCount = 0, pendingAdsCount = 0, adminUser }) {
  const table = admins.length ? `<div class="table-scroll"><table>
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
    <tbody>${admins.map((a) => renderAdminUserRow(a, adminUser.id)).join('')}</tbody>
  </table></div>` : '<p class="empty">No admin accounts yet.</p>';

  const headerActions = `<button type="button" class="btn-primary" id="open-admin-user-modal">${ICON_PLUS} New admin</button>`;

  const modal = `
    <div class="modal-overlay" id="admin-user-modal-overlay" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title">
        <div class="modal-header">
          <h2 id="admin-user-modal-title">New admin</h2>
          <button type="button" class="modal-close" id="admin-user-modal-close" aria-label="Close">${ICON_X}</button>
        </div>
        <form method="POST" action="/api/admin/users/create">
          <label for="admin-user-name">Name</label>
          <input type="text" id="admin-user-name" name="displayName" maxlength="60" required>
          <label for="admin-user-email">Email</label>
          <input type="email" id="admin-user-email" name="email" required>
          <label for="admin-user-password">Password</label>
          <input type="password" id="admin-user-password" name="password" minlength="8" required>
          <label for="admin-user-role">Role</label>
          <select id="admin-user-role" name="role" required>
            <option value="agent">Agent -- submissions only</option>
            <option value="investor">Investor -- ad/social revenue only, read-only</option>
            <option value="superadmin">Superadmin -- full access</option>
          </select>
          <button type="submit" class="start-campaign">${ICON_PLUS} Create admin</button>
        </form>
      </div>
    </div>
    <div class="modal-overlay" id="reset-password-modal-overlay" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-password-modal-title">
        <div class="modal-header">
          <h2 id="reset-password-modal-title">Reset password for <span id="reset-password-target-name"></span></h2>
          <button type="button" class="modal-close" id="reset-password-modal-close" aria-label="Close">${ICON_X}</button>
        </div>
        <form method="POST" action="/api/admin/users/reset-password">
          <input type="hidden" id="reset-password-target-id" name="id" value="">
          <label for="reset-password-new">New password</label>
          <input type="password" id="reset-password-new" name="password" minlength="8" required>
          <p class="field-hint">This signs them out everywhere immediately -- they'll need to log in again with the new password.</p>
          <button type="submit" class="start-campaign">Reset password</button>
        </form>
      </div>
    </div>
  `;

  const script = `
    var adminUserModalOverlay = document.getElementById('admin-user-modal-overlay');
    var openBtn = document.getElementById('open-admin-user-modal');
    var closeBtn = document.getElementById('admin-user-modal-close');
    function openAdminUserModal() { adminUserModalOverlay.hidden = false; document.getElementById('admin-user-name').focus(); }
    function closeAdminUserModal() { adminUserModalOverlay.hidden = true; }
    openBtn.addEventListener('click', openAdminUserModal);
    closeBtn.addEventListener('click', closeAdminUserModal);
    adminUserModalOverlay.addEventListener('click', function (e) { if (e.target === adminUserModalOverlay) closeAdminUserModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !adminUserModalOverlay.hidden) closeAdminUserModal(); });

    var resetPasswordModalOverlay = document.getElementById('reset-password-modal-overlay');
    var resetPasswordClose = document.getElementById('reset-password-modal-close');
    var resetPasswordTargetId = document.getElementById('reset-password-target-id');
    var resetPasswordTargetName = document.getElementById('reset-password-target-name');
    function closeResetPasswordModal() { resetPasswordModalOverlay.hidden = true; }
    document.querySelectorAll('.reset-password-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        resetPasswordTargetId.value = btn.getAttribute('data-id');
        resetPasswordTargetName.textContent = btn.getAttribute('data-name');
        resetPasswordModalOverlay.hidden = false;
        document.getElementById('reset-password-new').focus();
      });
    });
    resetPasswordClose.addEventListener('click', closeResetPasswordModal);
    resetPasswordModalOverlay.addEventListener('click', function (e) { if (e.target === resetPasswordModalOverlay) closeResetPasswordModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !resetPasswordModalOverlay.hidden) closeResetPasswordModal(); });
  `;

  return renderLayout({
    active: 'users',
    title: 'Admins',
    subtitle: `${admins.length} account${admins.length === 1 ? '' : 's'}`,
    badges: { submissions: pendingEntriesCount || null, ads: pendingAdsCount || null },
    headerActions,
    content: table,
    modal,
    script,
    adminUser
  });
}

function renderAdCard(ad) {
  const packageLabel = PACKAGE_LABELS[ad.package] || ad.package;
  const slotLabel = SLOT_LABELS[ad.slot] || ad.slot;
  return `<div class="card">
    <div class="meta"><strong>${escapeHtml(slotLabel)}</strong></div>
    <div class="meta">Paid: ${formatNaira(ad.amount_kobo / 100)} &middot; ${escapeHtml(packageLabel)}</div>
    <div class="meta">Links to: <a href="${escapeHtml(ad.link_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ad.link_url)}</a></div>
    <img src="/admin/ads/image/${encodeURIComponent(ad.id)}" alt="ad creative">
    <div class="actions">
      <form method="POST" action="/api/admin/ads/review">
        <input type="hidden" name="id" value="${escapeHtml(ad.id)}">
        <input type="hidden" name="action" value="approve">
        <button type="submit" class="approve">${ICON_CHECK} Approve</button>
      </form>
      <form method="POST" action="/api/admin/ads/review">
        <input type="hidden" name="id" value="${escapeHtml(ad.id)}">
        <input type="hidden" name="action" value="reject">
        <input type="text" name="reason" placeholder="Reason (optional)">
        <button type="submit" class="reject">${ICON_X} Reject</button>
      </form>
    </div>
  </div>`;
}
