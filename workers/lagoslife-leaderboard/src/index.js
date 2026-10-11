import { readThroughCache } from './cache.js';
import { requireBasicAuth } from './adminAuth.js';
import { verifyTurnstileToken } from './turnstile.js';
import { detectImageMimeType, extForContentType, putObject, getObject } from './r2.js';
import {
  derivePasswordHash,
  verifyPassword,
  generateSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  readSessionToken,
  readVisitorId,
  visitorCookieHeader,
  SESSION_TTL_SECONDS,
  readAdminSessionToken,
  adminSessionCookieHeader,
  clearAdminSessionCookieHeader,
  ADMIN_SESSION_TTL_SECONDS
} from './auth.js';
import {
  hashIp,
  getApprovedLeaderboard,
  getPendingQueue,
  countPendingEntries,
  getApprovedEntries,
  countRecentSubmissionsByIpHash,
  insertPendingEntry,
  getEntryById,
  getEntryWithRank,
  reviewEntry,
  createAccount,
  getAccountByEmail,
  updateAccountProfile,
  updateAccountAvatar,
  createSession,
  deleteSession,
  getAccountBySessionToken,
  getEntriesForAccount,
  createPendingAd,
  createSponsorAd,
  getAdById,
  markAdPendingReview,
  getPendingReviewAds,
  approveAd,
  rejectAd,
  getActiveAdsForSlot,
  countAdsInSlot,
  getAdRevenueBySlot,
  createPendingSocialUnlock,
  getSocialUnlockById,
  markSocialUnlockPaid,
  getSocialUnlockRevenue,
  getActiveCampaign,
  startCampaign,
  endActiveCampaign,
  getRecentCampaigns,
  setCampaignViews,
  getLastEndedCampaign,
  getPastCampaignsWithWinners,
  hasAccountEnteredCampaign,
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  countAdminUsers,
  getAdminUserByEmail,
  getAdminUserById,
  createAdminUser,
  listAdminUsers,
  setAdminUserDisabled,
  setAdminUserRole,
  deleteAdminUser,
  setAdminUserPassword,
  deleteAdminSessionsForUser,
  countActiveSuperadmins,
  createAdminSession,
  deleteAdminSession,
  getAdminUserBySessionToken
} from './db.js';
import { initializeTransaction, verifyTransaction, verifyWebhookSignature } from './paystack.js';
import { renderPublicPage } from './templates/publicPage.js';
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_BASE64 } from './assets.js';
import { renderAnnouncementsPage } from './templates/announcementsPage.js';
import { renderPastCampaignsPage } from './templates/pastCampaignsPage.js';
import { PresenceCounter } from './presenceObject.js';

// Re-exported so wrangler can resolve the `class_name = "PresenceCounter"`
// durable_objects binding against this Worker's main module (src/index.js).
export { PresenceCounter };

// All presence pings/reads go to the one global DO instance -- see
// presenceObject.js for why this is a single instance, not sharded.
function presenceStub(env) {
  const id = env.PRESENCE_DO.idFromName('global');
  return env.PRESENCE_DO.get(id);
}

// Distinct visitors active at any point during [startedAt, endedAt] --
// null on any failure (DO unreachable etc.) rather than 0, so the UI can
// tell "genuinely zero" apart from "couldn't be computed right now".
async function getCampaignViewsRange(env, startedAt, endedAt) {
  try {
    const stub = presenceStub(env);
    const res = await stub.fetch(`https://presence/stats-range?start=${startedAt}&end=${endedAt}`);
    const data = await res.json();
    return typeof data.views === 'number' ? data.views : null;
  } catch (error) {
    console.error('Presence stats-range fetch failed:', error);
    return null;
  }
}

// An ACTIVE campaign's views are always computed live (it's still
// running, nothing to freeze yet). An ENDED campaign's views are
// computed once and persisted -- the presence DO only keeps one
// first_seen/last_seen row per visitor, which a LATER campaign's
// traffic would silently overwrite if this were re-queried after the
// fact, so the first admin page load after a campaign ends is what
// locks its number in for good.
async function ensureCampaignViews(env, campaign) {
  if (campaign.status === 'active') {
    return getCampaignViewsRange(env, campaign.started_at, Math.floor(Date.now() / 1000));
  }
  if (campaign.views_count != null) return campaign.views_count;
  const views = await getCampaignViewsRange(env, campaign.started_at, campaign.ended_at || Math.floor(Date.now() / 1000));
  if (views != null) await setCampaignViews(env, campaign.id, views);
  return views;
}
import { renderOverviewPage, renderSubmissionsPage, renderAdsPage, renderCampaignsPage, renderAdminAnnouncementsPage, renderAdminLoginPage, renderAdminSetupPage, renderAdminUsersPage } from './templates/adminPage.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Defense-in-depth alongside the client-side output escaping fix for the
// stored-XSS risk these fields carried (unescaped into podium/rest-list/
// profile/social-link HTML) -- real usernames on every platform this
// touches (Instagram/TikTok/X/Snapchat, and Lagos Life's own in-game
// handle) fit this charset; display_name is NOT restricted this way
// since a real person's name legitimately needs spaces/punctuation/
// unicode -- that field relies on output escaping alone, correctly.
const HANDLE_RE = /^[a-zA-Z0-9._-]+$/;

// Builds each social profile URL from the stored bare handle -- see
// migrations/0004_social_links.sql for why only the handle is persisted.
function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.display_name,
    lagosLifeHandle: account.lagos_life_handle,
    hasAvatar: !!account.avatar_key,
    instagramHandle: account.instagram_handle || null,
    tiktokHandle: account.tiktok_handle || null,
    twitterHandle: account.twitter_handle || null,
    snapchatHandle: account.snapchat_handle || null,
    instagramUrl: account.instagram_handle ? `https://instagram.com/${account.instagram_handle}` : null,
    tiktokUrl: account.tiktok_handle ? `https://tiktok.com/@${account.tiktok_handle}` : null,
    twitterUrl: account.twitter_handle ? `https://x.com/${account.twitter_handle}` : null,
    snapchatUrl: account.snapchat_handle ? `https://www.snapchat.com/add/${account.snapchat_handle}` : null,
    socialUnlockEndsAt: account.social_unlock_ends_at || null
  };
}

// Strips a leading "@" and trims/caps length -- users will paste either
// "username" or "@username" interchangeably. Empty input clears the field
// (stored as NULL) rather than persisting an empty string.
function normalizeHandle(raw) {
  const value = String(raw || '').trim().replace(/^@+/, '').slice(0, 30);
  return value || null;
}

// The Lagos Life username field is required (unlike the optional social
// handles above), so this strips the same leading "@" a player is likely
// to type or paste (the game's own UI shows it as "@handle") without
// collapsing an empty result to null -- every display site already
// prepends its own "@", so a stored value that still had one baked in
// rendered as "@@handle".
function stripHandlePrefix(raw) {
  return String(raw || '').trim().replace(/^@+/, '');
}

// Looks up the current session's account, or null if there isn't one --
// NOT a hard-fail helper, since several routes (submit) treat "logged in"
// as optional context rather than a requirement. Routes that DO require a
// session check the null case themselves and return 401.
async function getSessionAccount(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  return getAccountBySessionToken(env, token);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function errorJson(message, status) {
  return json({ success: false, message }, status);
}

// Decoded once per isolate (not per request) -- the brand logo backing
// both the favicon and every page's OG/Twitter social-preview image
// (see src/assets.js). Long-lived, immutable cache: this only ever
// changes via a full redeploy, never at runtime.
let ogImageBytes = null;
async function handleOgImage() {
  if (!ogImageBytes) {
    ogImageBytes = Uint8Array.from(atob(OG_IMAGE_BASE64), (c) => c.charCodeAt(0));
  }
  return new Response(ogImageBytes, {
    headers: {
      'Content-Type': OG_IMAGE_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}

async function handleRoot(request, env, ctx) {
  return readThroughCache(
    ctx,
    'https://lagoslife.stora.com.ng/__cache/page',
    { freshTtl: 300, staleTtl: 1800 },
    async () => new Response(renderPublicPage(env), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    })
  );
}

// Static shell, same caching shape as handleRoot -- the actual list is
// fetched client-side via handleAnnouncementsApi below, same
// architecture as the main page's leaderboard/campaign data.
async function handleAnnouncementsPage(request, env, ctx) {
  return readThroughCache(
    ctx,
    'https://lagoslife.stora.com.ng/__cache/announcements-page',
    { freshTtl: 300, staleTtl: 1800 },
    async () => new Response(renderAnnouncementsPage(env), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    })
  );
}

// Backs both the header's quick popover (?limit=3) and the full
// /announcements page (no limit) -- announcements are rare/staff-posted,
// so a cheap short cache is plenty; no per-visitor state involved.
async function handleAnnouncementsApi(request, env, ctx) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 100;
  return readThroughCache(
    ctx,
    `https://lagoslife.stora.com.ng/__cache/announcements/${limit}`,
    { freshTtl: 60, staleTtl: 600 },
    async () => {
      const announcements = await getAnnouncements(env, limit);
      return json({
        announcements: announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          createdAt: a.created_at
        }))
      });
    }
  );
}

// Static shell, same architecture as handleAnnouncementsPage -- the list
// of past campaigns/winners is fetched client-side via
// handlePastCampaignsApi below.
async function handlePastCampaignsPage(request, env, ctx) {
  return readThroughCache(
    ctx,
    'https://lagoslife.stora.com.ng/__cache/past-campaigns-page',
    { freshTtl: 300, staleTtl: 1800 },
    async () => new Response(renderPastCampaignsPage(env), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    })
  );
}

// Campaigns end rarely (staff-triggered), so a short cache is plenty --
// same cadence as handleAnnouncementsApi.
async function handlePastCampaignsApi(request, env, ctx) {
  return readThroughCache(
    ctx,
    'https://lagoslife.stora.com.ng/__cache/past-campaigns',
    { freshTtl: 60, staleTtl: 600 },
    async () => {
      const campaigns = await getPastCampaignsWithWinners(env, 20);
      return json({
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          rewardDescription: c.reward_description,
          startedAt: c.started_at,
          endedAt: c.ended_at,
          winner: c.winner ? {
            displayName: c.winner.display_name,
            handle: c.winner.lagos_life_handle,
            accountId: c.winner.account_id,
            hasAvatar: !!c.winner.has_avatar,
            reportedBalance: c.winner.reported_balance
          } : null
        }))
      });
    }
  );
}

async function handleLeaderboard(request, env, ctx) {
  // Scoped to the active campaign (if any). Unlike the "submit to
  // unlock" half of the gate (still a soft UX mechanic -- see
  // handleCampaignStatus's comment), the daily reveal time IS enforced
  // right here: a campaign with a reveal time configured returns no
  // entries at all before that time passes, for anyone, regardless of
  // what the client sends -- the actual data never leaves the server
  // pre-reveal, not just a client-side gate that a devtools/curl user
  // could bypass. Checked BEFORE the cache lookup so an embargoed
  // campaign is never cached as "revealed" on any colo ahead of time.
  const campaign = await getActiveCampaign(env);
  if (campaign && !isCampaignRevealedNow(campaign.reveal_seconds_of_day, campaign.close_seconds_of_day)) {
    return errorJson('Results for this campaign have not been revealed yet.', 403);
  }
  // No campaign running right now -- freeze on the most recently ended
  // one instead of widening to every approved entry ever submitted.
  // This is a deliberate choice (reversed from this column's original
  // "provenance, not an exclusion filter" comment in
  // migrations/0006_campaigns.sql): a waiting-period visitor should see
  // "what the last campaign decided," not a merged all-time board that
  // never resets. The reveal gate above only ever applies to a campaign
  // that's still active -- an ended campaign's results are final, no
  // embargo makes sense on them.
  const effectiveCampaign = campaign || (await getLastEndedCampaign(env));
  const cacheKey = effectiveCampaign
    ? `https://lagoslife.stora.com.ng/__cache/leaderboard/${effectiveCampaign.id}`
    : 'https://lagoslife.stora.com.ng/__cache/leaderboard';
  return readThroughCache(
    ctx,
    cacheKey,
    { freshTtl: 30, staleTtl: 300 },
    async () => {
      const entries = await getApprovedLeaderboard(env, 100, effectiveCampaign ? effectiveCampaign.id : null);
      return json({ entries });
    }
  );
}

// Lagos (WAT, UTC+1) has no DST, so "seconds since Lagos midnight" is
// just a fixed offset away from the UTC epoch -- no timezone library
// needed. Backs the optional daily results-reveal gate below.
const LAGOS_UTC_OFFSET_SECONDS = 3600;
function lagosSecondsOfDay(epochSeconds) {
  return ((epochSeconds + LAGOS_UTC_OFFSET_SECONDS) % 86400 + 86400) % 86400;
}

// Parses an HTML time input's value (HH:MM, Lagos local time) into
// seconds-since-midnight. null for a blank/absent field (a real,
// meaningful value -- "no time set"), the INVALID_TIME_OF_DAY sentinel
// for a non-blank value that doesn't parse as a valid time.
const INVALID_TIME_OF_DAY = Symbol('invalid-time-of-day');
function parseTimeOfDay(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  const match = raw.match(/^([0-2]\d):([0-5]\d)$/);
  if (!match) return INVALID_TIME_OF_DAY;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23) return INVALID_TIME_OF_DAY;
  return hours * 3600 + minutes * 60;
}
// closeSecondsOfDay is optional -- a "sneak peek" window (reveal until
// close, then re-gated for the rest of the day) instead of the default
// "stays open the rest of the day once revealed." Always later than
// revealSecondsOfDay within the same calendar day -- no overnight-
// wrapping window support (enforced at creation, see handleAdminStartCampaign).
//
// revealAtEnd is a third, mutually exclusive mode: completely withheld
// for as long as the campaign is active, regardless of reveal/close time
// of day -- no daily unlock at all, only once the campaign itself ends.
// Checked first and short-circuits, since this function is only ever
// called for a campaign that's still active in the first place (an
// ended campaign never reaches a reveal check anywhere in this file).
function isCampaignRevealedNow(revealSecondsOfDay, closeSecondsOfDay, revealAtEnd) {
  if (revealAtEnd) return false;
  if (revealSecondsOfDay == null) return true;
  const nowOfDay = lagosSecondsOfDay(Math.floor(Date.now() / 1000));
  if (nowOfDay < revealSecondsOfDay) return false;
  if (closeSecondsOfDay != null && nowOfDay >= closeSecondsOfDay) return false;
  return true;
}
// null means "revealed right now" (caller only needs this when not
// revealed) -- also null for revealAtEnd, since there's no daily time to
// count down to; the client shows end-of-campaign messaging instead (see
// handleCampaignStatus's revealAtEnd flag). Two distinct "not revealed"
// cases otherwise: not yet reached today's reveal (-> today's reveal
// time), or already past today's close (-> tomorrow's reveal time).
function nextCampaignRevealAt(revealSecondsOfDay, closeSecondsOfDay, revealAtEnd) {
  if (revealAtEnd) return null;
  const now = Math.floor(Date.now() / 1000);
  const nowOfDay = lagosSecondsOfDay(now);
  if (nowOfDay < revealSecondsOfDay) {
    return now - nowOfDay + revealSecondsOfDay;
  }
  if (closeSecondsOfDay != null && nowOfDay >= closeSecondsOfDay) {
    return now - nowOfDay + 86400 + revealSecondsOfDay;
  }
  return null;
}

// An approved entry's own rank is only shown once its campaign's
// results are actually revealed -- otherwise checking "Your rank" or
// the Profile tab would be a straight spoiler for an embargo the main
// leaderboard already enforces server-side (getEntryWithRank/
// getEntriesForAccount compute the rank regardless; this is the policy
// decision on top of that, same split as the main leaderboard's own
// reveal gate). No campaign tied to the entry, or that campaign having
// already ended, means there's nothing left to embargo.
function isEntryRankRevealed(entry) {
  if (!entry.campaign_id || entry.campaign_status !== 'active') return true;
  return isCampaignRevealedNow(entry.reveal_seconds_of_day, entry.close_seconds_of_day, entry.reveal_at_end);
}

// Strips the internal campaign/reveal-join fields db.js attached (never
// meant to reach the client) and withholds rank if not yet revealed.
function sanitizeEntryForClient(entry) {
  const revealed = isEntryRankRevealed(entry);
  return {
    id: entry.id,
    display_name: entry.display_name,
    lagos_life_handle: entry.lagos_life_handle,
    reported_balance: entry.reported_balance,
    status: entry.status,
    rejection_reason: entry.rejection_reason,
    created_at: entry.created_at,
    rank: revealed ? entry.rank : null,
    rankRevealed: revealed
  };
}

// Per-visitor (can't go through the shared page cache -- it depends on
// this specific session) -- tells the client whether to show the real
// leaderboard or a "submit to unlock" gate. See the campaign-mode
// discussion: the gate is a soft UX mechanic, not a security boundary --
// this endpoint is intentionally honest about who's unlocked rather than
// trying to hide the real data from a motivated devtools user, since
// obscuring it further would just be security theater.
async function handleCampaignStatus(request, env) {
  const campaign = await getActiveCampaign(env);
  if (!campaign) {
    // Waiting period: no gate to apply (unlocked: true, unchanged), but
    // tell the client which campaign the board is now frozen on (see
    // handleLeaderboard) so it can show "Final results: <name>" instead
    // of silently looking identical to a real live board.
    const lastEnded = await getLastEndedCampaign(env);
    return json({
      active: false,
      unlocked: true,
      lastEndedCampaign: lastEnded ? { id: lastEnded.id, name: lastEnded.name } : null
    });
  }

  const account = await getSessionAccount(request, env);
  const unlocked = account ? await hasAccountEnteredCampaign(env, campaign.id, account.id) : false;
  const revealed = isCampaignRevealedNow(campaign.reveal_seconds_of_day, campaign.close_seconds_of_day, campaign.reveal_at_end);

  // Only meaningful while currently revealed AND a close time is set --
  // tells the client when today's sneak-peek window shuts, so it can
  // re-check and re-gate itself live instead of leaving a stale,
  // already-closed board on screen until some other action refreshes it.
  let closesAt = null;
  if (revealed && campaign.close_seconds_of_day != null) {
    const now = Math.floor(Date.now() / 1000);
    closesAt = now - lagosSecondsOfDay(now) + campaign.close_seconds_of_day;
  }

  return json({
    active: true,
    // Kept meaning exactly "has this visitor submitted" (unchanged) --
    // the separate `revealed` flag below is what actually gates seeing
    // the board now, so the client can tell "submit to unlock" apart
    // from "you're in, come back at the reveal time" instead of both
    // collapsing into the same gate message.
    unlocked,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      rewardDescription: campaign.reward_description,
      endsAt: campaign.ends_at || null,
      revealed,
      // No daily reveal time to count down to in this mode -- the client
      // shows "results at the end of the campaign" messaging instead,
      // keyed off this flag rather than trying to infer it from
      // nextRevealAt being null (null already meant something else: "no
      // gate at all" for a never-gated campaign).
      revealAtEnd: !!campaign.reveal_at_end,
      nextRevealAt: !revealed ? nextCampaignRevealAt(campaign.reveal_seconds_of_day, campaign.close_seconds_of_day, campaign.reveal_at_end) : null,
      closesAt
    }
  });
}

// Order matters: cheapest/least-trusting checks first, so a scripted or
// bot submission never reaches Turnstile, D1, or R2 work.
async function handleSubmit(request, env) {
  // Optional -- an anonymous visitor can still submit exactly as before
  // (account_id stays null); a logged-in one just gets this entry linked
  // to their account so the Profile tab can find it without localStorage.
  const sessionAccount = await getSessionAccount(request, env);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. Flood guard -- fails OPEN (same convention as subdomain-router's
  // BROWSE_RATE_LIMITER), a cheap first pass only.
  try {
    const { success } = await env.SUBMIT_FLOOD_LIMITER.limit({ key: clientIp });
    if (!success) {
      return errorJson('Too many requests. Please slow down and try again shortly.', 429);
    }
  } catch (error) {
    console.error('Submit flood limiter check failed, allowing request:', error);
  }

  // 2. Reject an oversized body before ever buffering it.
  const maxBytes = Number(env.MAX_SCREENSHOT_BYTES || 5242880);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes + 1024 * 64) {
    return errorJson('Screenshot is too large.', 413);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    return errorJson('Could not read the submission.', 400);
  }

  const displayName = String(formData.get('display_name') || '').trim();
  const lagosLifeHandle = stripHandlePrefix(formData.get('lagos_life_handle'));
  const reportedBalanceRaw = formData.get('reported_balance');
  const screenshot = formData.get('screenshot');
  const turnstileToken = String(formData.get('cf-turnstile-response') || '');

  if (!displayName || displayName.length > 60) {
    return errorJson('Enter your name (max 60 characters).', 400);
  }
  if (!lagosLifeHandle || lagosLifeHandle.length > 60 || !HANDLE_RE.test(lagosLifeHandle)) {
    return errorJson('Enter a valid Lagos Life username (letters, numbers, ., _, - only; max 60 characters).', 400);
  }
  const reportedBalance = Number(reportedBalanceRaw);
  if (!Number.isFinite(reportedBalance) || reportedBalance < 0 || reportedBalance > 999999999999999) {
    return errorJson('Enter a valid balance.', 400);
  }
  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return errorJson('A screenshot of your balance is required.', 400);
  }
  if (screenshot.size > maxBytes) {
    return errorJson('Screenshot is too large.', 413);
  }

  // 3. Once-per-campaign check -- only enforceable for a logged-in account
  // (see hasAccountEnteredCampaign's own comment on why anonymous
  // submitters aren't deduped here). Cheap indexed lookup, so it runs
  // before the Turnstile network call.
  const activeCampaign = await getActiveCampaign(env);
  if (activeCampaign && sessionAccount) {
    const alreadyEntered = await hasAccountEnteredCampaign(env, activeCampaign.id, sessionAccount.id);
    if (alreadyEntered) {
      return errorJson('You have already submitted an entry for this campaign.', 409);
    }
  }

  // 4. Turnstile -- fails CLOSED. This IS the real anti-bot work.
  const turnstileOk = await verifyTurnstileToken(env, turnstileToken, clientIp);
  if (!turnstileOk) {
    return errorJson('Bot check failed -- please retry.', 400);
  }

  // 5. Business-rule throttle (D1-backed, fails CLOSED -- see db.js).
  const ipHash = await hashIp(env, clientIp);
  let recentCount;
  try {
    recentCount = await countRecentSubmissionsByIpHash(env, ipHash);
  } catch (error) {
    console.error('Hourly submission count check failed:', error);
    return errorJson('Could not process your submission right now -- try again shortly.', 503);
  }
  const maxPerHour = Number(env.MAX_SUBMISSIONS_PER_HOUR_PER_IP || 3);
  if (recentCount >= maxPerHour) {
    return errorJson('You have reached the submission limit for now -- try again later.', 429);
  }

  // 6. Sniff real file bytes -- never trust the client's declared type.
  const bytes = new Uint8Array(await screenshot.arrayBuffer());
  const contentType = detectImageMimeType(bytes);
  if (!contentType) {
    return errorJson('That file does not look like a valid JPEG, PNG, or WebP image.', 400);
  }

  const id = crypto.randomUUID();
  const screenshotKey = `submissions/${id}.${extForContentType(contentType)}`;

  try {
    await putObject(env, screenshotKey, bytes, contentType);
    await insertPendingEntry(env, {
      id,
      displayName,
      lagosLifeHandle,
      reportedBalance,
      screenshotKey,
      screenshotContentType: contentType,
      submitterIpHash: ipHash,
      accountId: sessionAccount ? sessionAccount.id : null,
      campaignId: activeCampaign ? activeCampaign.id : null
    });
  } catch (error) {
    console.error('Failed to store submission:', error);
    return errorJson('Could not save your submission -- try again.', 500);
  }

  return json({ success: true, message: 'Submitted for review.', id }, 201);
}

// Backs the "Your rank" tab-bar chip and the Profile tab -- the client
// remembers its own submission id in localStorage after a successful
// /api/submit and looks it up here. No auth (the id is an unguessable
// crypto.randomUUID(), same trust model as the admin screenshot route's
// id lookup, just without the Basic Auth gate since nothing sensitive is
// returned). Not cached -- cheap, low-volume, per-visitor varying query,
// unlike the shared /api/leaderboard hot path.
async function handleGetEntry(env, id) {
  const entry = await getEntryWithRank(env, id);
  if (!entry) return errorJson('Not found', 404);
  return json(sanitizeEntryForClient(entry));
}

// -- Presence: live + all-time visitor counts ----------------------------
// Anonymous, first-party only -- the visitor_id cookie identifies a
// browser to this page alone (not cross-site tracking), purely so the
// same tab doesn't get double-counted across repeated pings.

async function handlePresencePing(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.PRESENCE_FLOOD_LIMITER.limit({ key: clientIp });
    if (!success) return errorJson('Too many requests.', 429);
  } catch (error) {
    console.error('Presence flood limiter check failed, allowing request:', error);
  }

  let visitorId = readVisitorId(request);
  if (!visitorId) visitorId = crypto.randomUUID();

  try {
    const stub = presenceStub(env);
    await stub.fetch('https://presence/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId })
    });
  } catch (error) {
    console.error('Failed to record presence:', error);
    // Still ack the ping and (re)issue the cookie -- a dropped presence
    // write just means this one ping doesn't count, not a client error.
  }

  const headers = { 'Content-Type': 'application/json' };
  // Re-issued on every ping, not just when new -- keeps the cookie's
  // Max-Age rolling for an active returning visitor instead of expiring
  // exactly 365 days after their very first visit regardless of how often
  // they come back.
  headers['Set-Cookie'] = visitorCookieHeader(visitorId);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

async function handlePresenceStats(request, env, ctx) {
  return readThroughCache(
    ctx,
    'https://lagoslife.stora.com.ng/__cache/presence',
    { freshTtl: 15, staleTtl: 60 },
    async () => {
      const stub = presenceStub(env);
      const res = await stub.fetch('https://presence/stats');
      const data = await res.json();
      return json(data);
    }
  );
}

// -- Auth: email + password ---------------------------------------------
// No email-sending service required (unlike the email-code approach this
// replaced) -- Resend's free tier would have covered this volume easily,
// but a password needs no delivery step at all, which is simpler to ship
// for now. A "forgot password" flow would need email again later; out of
// scope until that's actually asked for.

const MIN_PASSWORD_LENGTH = 8;

function parseEmailPassword(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  return { email, password };
}

async function handleSignup(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.AUTH_FLOOD_LIMITER.limit({ key: clientIp });
    if (!success) return errorJson('Too many requests. Please slow down and try again shortly.', 429);
  } catch (error) {
    console.error('Auth flood limiter check failed, allowing request:', error);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Could not read the request.', 400);
  }
  const { email, password } = parseEmailPassword(body);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return errorJson('Enter a valid email address.', 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return errorJson(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  const displayName = String(body?.displayName || '').trim();
  const lagosLifeHandle = stripHandlePrefix(body?.lagosLifeHandle);
  if (!displayName || displayName.length > 60) {
    return errorJson('Enter your name (max 60 characters).', 400);
  }
  if (!lagosLifeHandle || lagosLifeHandle.length > 60 || !HANDLE_RE.test(lagosLifeHandle)) {
    return errorJson('Enter a valid Lagos Life username (letters, numbers, ., _, - only; max 60 characters).', 400);
  }

  const { hash, salt } = await derivePasswordHash(password);
  const account = await createAccount(env, email, hash, salt, displayName, lagosLifeHandle);
  if (!account) {
    return errorJson('That email is already registered -- try logging in instead.', 409);
  }

  const token = generateSessionToken();
  await createSession(env, token, account.id, SESSION_TTL_SECONDS);

  return new Response(JSON.stringify({ success: true, account: publicAccount(account) }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookieHeader(token) }
  });
}

async function handleLogin(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.AUTH_FLOOD_LIMITER.limit({ key: clientIp });
    if (!success) return errorJson('Too many requests. Please slow down and try again shortly.', 429);
  } catch (error) {
    console.error('Auth flood limiter check failed, allowing request:', error);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Could not read the request.', 400);
  }
  const { email, password } = parseEmailPassword(body);
  if (!EMAIL_RE.test(email) || !password) {
    return errorJson('Enter your email and password.', 400);
  }

  const account = await getAccountByEmail(env, email);
  // Same generic message whether the email doesn't exist or the password
  // is wrong -- doesn't confirm/deny which part was incorrect.
  const genericError = () => errorJson('Incorrect email or password.', 401);
  if (!account || !account.password_hash) return genericError();

  const ok = await verifyPassword(password, account.password_salt, account.password_hash);
  if (!ok) return genericError();

  const token = generateSessionToken();
  await createSession(env, token, account.id, SESSION_TTL_SECONDS);

  return new Response(JSON.stringify({ success: true, account: publicAccount(account) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookieHeader(token) }
  });
}

async function handleLogout(request, env) {
  const token = readSessionToken(request);
  if (token) await deleteSession(env, token);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookieHeader() }
  });
}

async function handleMe(request, env) {
  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);
  const entries = await getEntriesForAccount(env, account.id);
  return json({ account: publicAccount(account), entries: entries.map(sanitizeEntryForClient) });
}

async function handleUpdateProfile(request, env) {
  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Could not read the request.', 400);
  }
  const displayName = String(body?.displayName || '').trim();
  const lagosLifeHandle = stripHandlePrefix(body?.lagosLifeHandle);
  if (!displayName || displayName.length > 60) {
    return errorJson('Enter your name (max 60 characters).', 400);
  }
  if (!lagosLifeHandle || lagosLifeHandle.length > 60 || !HANDLE_RE.test(lagosLifeHandle)) {
    return errorJson('Enter a valid Lagos Life username (letters, numbers, ., _, - only; max 60 characters).', 400);
  }
  const instagramHandle = normalizeHandle(body?.instagramHandle);
  const tiktokHandle = normalizeHandle(body?.tiktokHandle);
  const twitterHandle = normalizeHandle(body?.twitterHandle);
  const snapchatHandle = normalizeHandle(body?.snapchatHandle);
  for (const [label, handle] of [['Instagram', instagramHandle], ['TikTok', tiktokHandle], ['X', twitterHandle], ['Snapchat', snapchatHandle]]) {
    if (handle && !HANDLE_RE.test(handle)) {
      return errorJson(`Enter a valid ${label} handle (letters, numbers, ., _, - only).`, 400);
    }
  }

  await updateAccountProfile(env, account.id, { displayName, lagosLifeHandle, instagramHandle, tiktokHandle, twitterHandle, snapchatHandle });
  return json({ success: true });
}

async function handleUpdateAvatar(request, env) {
  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  const maxBytes = Number(env.MAX_AVATAR_BYTES || 2097152);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes + 1024 * 64) {
    return errorJson('Image is too large.', 413);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson('Could not read the upload.', 400);
  }
  const avatar = formData.get('avatar');
  if (!(avatar instanceof File) || avatar.size === 0) {
    return errorJson('Choose an image to upload.', 400);
  }
  if (avatar.size > maxBytes) {
    return errorJson('Image is too large.', 413);
  }

  const bytes = new Uint8Array(await avatar.arrayBuffer());
  const contentType = detectImageMimeType(bytes);
  if (!contentType) {
    return errorJson('That file does not look like a valid JPEG, PNG, or WebP image.', 400);
  }

  // Fixed key (not per-upload) -- a new avatar simply overwrites the old
  // object in place, so there's nothing to separately delete/garbage-collect.
  const avatarKey = `avatars/${account.id}.${extForContentType(contentType)}`;
  await putObject(env, avatarKey, bytes, contentType);
  await updateAccountAvatar(env, account.id, avatarKey, contentType);

  return json({ success: true });
}

// -- Self-serve ads -------------------------------------------------------
// One-time payments (not recurring), so the redirect-confirm path is the
// primary flow; the webhook below is a safety net for the case where a
// buyer closes the tab before Paystack redirects them back.

const AD_URL_RE = /^https?:\/\//i;

// Which pricing tier and concurrent-ad cap each position carries. Cap
// scales with value: the premium positions (top-of-leaderboard, the
// campaign sponsor tag) stay tight so any one advertiser's exposure stays
// meaningful; the lower-value positions allow more concurrent ads since
// each individual rotation turn matters less.
const SLOT_CONFIG = {
  ranking_top: { tier: 'premium', capacity: 4, label: 'Leaderboard top' },
  ranking_bottom: { tier: 'standard', capacity: 8, label: 'Leaderboard bottom' },
  profile_tab: { tier: 'standard', capacity: 8, label: 'Profile tab' },
  campaign_banner: { tier: 'campaign', capacity: 4, label: 'Campaign sponsor' }
};

function adPriceKobo(env, slot, pkg) {
  const config = SLOT_CONFIG[slot];
  if (!config) return null;
  if (config.tier === 'campaign') {
    return Number(env.AD_PRICE_CAMPAIGN_BANNER_KOBO || 0) || null;
  }
  const prefix = config.tier === 'premium' ? 'AD_PRICE_PREMIUM_' : 'AD_PRICE_STANDARD_';
  const map = {
    day: Number(env[`${prefix}DAY_KOBO`] || 0),
    week: Number(env[`${prefix}WEEK_KOBO`] || 0),
    month: Number(env[`${prefix}MONTH_KOBO`] || 0)
  };
  return map[pkg] || null;
}

// Flat per-day rate, not tiered packages -- days is whatever the
// advertiser picked (1-90, see migrations/0013's CHECK constraint).
function socialUnlockPriceKobo(env, days) {
  const perDay = Number(env.SOCIAL_UNLOCK_PRICE_PER_DAY_KOBO || 0);
  if (!perDay || !Number.isFinite(days) || days < 1 || days > 90) return null;
  return Math.round(perDay * days);
}

function publicAd(ad) {
  return {
    id: ad.id,
    imageUrl: `/ads/image/${ad.id}`,
    linkUrl: ad.link_url
  };
}

// Shared by the ads + social-unlock payment flow (create/pay/confirm for
// both) -- fails OPEN, same convention as every other flood limiter in
// this file. Returns a 429 Response if the limiter trips, or null to
// proceed.
async function checkPaymentFlood(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.PAYMENT_FLOOD_LIMITER.limit({ key: clientIp });
    if (!success) return errorJson('Too many requests. Please slow down and try again shortly.', 429);
  } catch (error) {
    console.error('Payment flood limiter check failed, allowing request:', error);
  }
  return null;
}

async function handleCreateAd(request, env) {
  const flooded = await checkPaymentFlood(request, env);
  if (flooded) return flooded;

  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  const maxBytes = Number(env.MAX_AD_IMAGE_BYTES || 3145728);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes + 1024 * 64) return errorJson('Image is too large.', 413);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson('Could not read the upload.', 400);
  }

  const image = formData.get('image');
  const linkUrl = String(formData.get('linkUrl') || '').trim();
  const slot = String(formData.get('slot') || '').trim();
  const slotConfig = SLOT_CONFIG[slot];

  if (!(image instanceof File) || image.size === 0) return errorJson('Choose an image to upload.', 400);
  if (image.size > maxBytes) return errorJson('Image is too large.', 413);
  if (!AD_URL_RE.test(linkUrl) || linkUrl.length > 2048) {
    return errorJson('Enter a valid link starting with http:// or https://.', 400);
  }
  if (!slotConfig) return errorJson('Choose a valid placement.', 400);

  // campaign_banner is only purchasable while a campaign is actually
  // running -- it sponsors THAT campaign, not a fixed day/week/month.
  let campaignId = null;
  let pkg;
  if (slotConfig.tier === 'campaign') {
    const campaign = await getActiveCampaign(env);
    if (!campaign) {
      return errorJson('No campaign is currently running -- this placement is only available while one is active.', 409);
    }
    campaignId = campaign.id;
    pkg = 'campaign';
  } else {
    pkg = String(formData.get('package') || '').trim();
  }

  const amountKobo = adPriceKobo(env, slot, pkg);
  if (!amountKobo) return errorJson('Choose a valid package.', 400);

  // Capacity check -- before any payment is attempted, so nobody pays for
  // a placement that's already full. See countAdsInSlot's own comment for
  // exactly what counts against the cap.
  const currentCount = await countAdsInSlot(env, slot, campaignId);
  if (currentCount >= slotConfig.capacity) {
    return errorJson(`This placement is fully booked right now (${slotConfig.capacity}/${slotConfig.capacity} slots taken) -- try a different placement or check back later.`, 409);
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const contentType = detectImageMimeType(bytes);
  if (!contentType) return errorJson('That file does not look like a valid JPEG, PNG, or WebP image.', 400);

  const id = crypto.randomUUID();
  const imageKey = `ads/${id}.${extForContentType(contentType)}`;

  try {
    await putObject(env, imageKey, bytes, contentType);
    await createPendingAd(env, {
      id, accountId: account.id, slot, campaignId, imageKey, imageContentType: contentType,
      linkUrl, pkg, amountKobo
    });
  } catch (error) {
    console.error('Failed to create ad:', error);
    return errorJson('Could not save your ad -- try again.', 500);
  }

  return json({ success: true, adId: id, amountKobo }, 201);
}

async function handlePayForAd(request, env, adId) {
  const flooded = await checkPaymentFlood(request, env);
  if (flooded) return flooded;

  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  const ad = await getAdById(env, adId);
  if (!ad || ad.account_id !== account.id) return errorJson('Ad not found.', 404);
  if (ad.status !== 'pending_payment') return errorJson('This ad has already been paid for.', 409);

  const url = new URL(request.url);
  let initResult;
  try {
    initResult = await initializeTransaction(env, {
      email: account.email,
      amountKobo: ad.amount_kobo,
      callbackUrl: `${url.origin}/?ad_confirm=${encodeURIComponent(adId)}`,
      metadata: { adId, accountId: account.id, purpose: 'lagoslife_ad' }
    });
  } catch (error) {
    console.error('Paystack initialize failed:', error.message);
    return errorJson('Could not start payment -- try again shortly.', 503);
  }

  return json({ success: true, authorizationUrl: initResult.authorization_url });
}

async function handleConfirmAdPayment(request, env, adId) {
  const flooded = await checkPaymentFlood(request, env);
  if (flooded) return flooded;

  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  const ad = await getAdById(env, adId);
  if (!ad || ad.account_id !== account.id) return errorJson('Ad not found.', 404);

  if (ad.status !== 'pending_payment') {
    // Already confirmed (possibly by the webhook beating this request) --
    // not an error, just report the current state.
    return json({ success: true, status: ad.status });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  if (!reference) return errorJson('Missing payment reference.', 400);

  let tx;
  try {
    tx = await verifyTransaction(env, reference);
  } catch (error) {
    console.error('Paystack verify failed:', error.message);
    return errorJson('Could not verify payment -- try again shortly.', 503);
  }

  if (tx.status !== 'success') {
    return json({ success: false, status: 'pending', message: 'Payment is not successful yet.' });
  }
  // Explicit amount check -- apps/dashboard's own equivalent route never
  // does this; adding it here since this is a one-time cash payment, not
  // a reusable Paystack plan, so there's nothing else cross-checking it.
  if (Number(tx.amount) !== Number(ad.amount_kobo)) {
    console.error(`Ad payment amount mismatch for ${adId}: expected ${ad.amount_kobo}, got ${tx.amount}`);
    return errorJson('Payment amount does not match -- contact support.', 409);
  }
  // Mandatory, not conditional -- a reference whose own metadata was
  // never bound to THIS ad (including a legit-but-unrelated reference
  // with no adId at all, e.g. one obtained from a different, already-
  // consumed purchase at the same kobo amount) must not pass just
  // because status/amount/ownership happen to line up. Without this,
  // the same successful reference could be replayed across any number
  // of a user's own pending ads priced at that exact amount.
  if (tx.metadata?.adId !== adId) {
    return errorJson('Payment reference does not match this ad.', 403);
  }

  await markAdPendingReview(env, adId, reference);
  return json({ success: true, status: 'pending_review' });
}

async function handleCreateSocialUnlock(request, env) {
  const flooded = await checkPaymentFlood(request, env);
  if (flooded) return flooded;

  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson('Could not read the request.', 400);
  }
  const days = Math.round(Number(body?.days));
  const amountKobo = socialUnlockPriceKobo(env, days);
  if (!amountKobo) return errorJson('Choose a number of days between 1 and 90.', 400);

  const id = crypto.randomUUID();
  await createPendingSocialUnlock(env, { id, accountId: account.id, days, amountKobo });

  const url = new URL(request.url);
  let initResult;
  try {
    initResult = await initializeTransaction(env, {
      email: account.email,
      amountKobo,
      callbackUrl: `${url.origin}/?social_unlock_confirm=${encodeURIComponent(id)}`,
      metadata: { socialUnlockId: id, accountId: account.id, purpose: 'lagoslife_social_unlock' }
    });
  } catch (error) {
    console.error('Paystack initialize failed:', error.message);
    return errorJson('Could not start payment -- try again shortly.', 503);
  }

  return json({ success: true, authorizationUrl: initResult.authorization_url });
}

async function handleConfirmSocialUnlock(request, env, unlockId) {
  const flooded = await checkPaymentFlood(request, env);
  if (flooded) return flooded;

  const account = await getSessionAccount(request, env);
  if (!account) return errorJson('Not logged in.', 401);

  const unlock = await getSocialUnlockById(env, unlockId);
  if (!unlock || unlock.account_id !== account.id) return errorJson('Purchase not found.', 404);

  if (unlock.status !== 'pending_payment') {
    // Already confirmed (possibly by the webhook beating this request) --
    // not an error, just report the current state.
    return json({ success: true, status: unlock.status });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  if (!reference) return errorJson('Missing payment reference.', 400);

  let tx;
  try {
    tx = await verifyTransaction(env, reference);
  } catch (error) {
    console.error('Paystack verify failed:', error.message);
    return errorJson('Could not verify payment -- try again shortly.', 503);
  }

  if (tx.status !== 'success') {
    return json({ success: false, status: 'pending', message: 'Payment is not successful yet.' });
  }
  if (Number(tx.amount) !== Number(unlock.amount_kobo)) {
    console.error(`Social unlock payment amount mismatch for ${unlockId}: expected ${unlock.amount_kobo}, got ${tx.amount}`);
    return errorJson('Payment amount does not match -- contact support.', 409);
  }
  // Mandatory, not conditional -- see handleConfirmAdPayment's identical
  // check for why an absent metadata.socialUnlockId must reject too, not
  // just a mismatched one.
  if (tx.metadata?.socialUnlockId !== unlockId) {
    return errorJson('Payment reference does not match this purchase.', 403);
  }

  const result = await markSocialUnlockPaid(env, unlockId, reference);
  return json({ success: true, status: 'paid', endsAt: result ? result.endsAt : null });
}

async function handlePaystackWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  const valid = await verifyWebhookSignature(env, rawBody, signature);
  if (!valid) return new Response('Invalid signature', { status: 401 });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  if (payload.event === 'charge.success') {
    const data = payload.data;
    const adId = data?.metadata?.adId;
    const socialUnlockId = data?.metadata?.socialUnlockId;
    if (adId && data?.status === 'success') {
      try {
        const ad = await getAdById(env, adId);
        // Idempotent -- only acts if still pending_payment, so this is a
        // harmless no-op whether the redirect-confirm already handled it
        // or this webhook fires more than once for the same event.
        if (ad && ad.status === 'pending_payment' && Number(data.amount) === Number(ad.amount_kobo)) {
          await markAdPendingReview(env, adId, data.reference);
        }
      } catch (error) {
        console.error('Webhook ad processing failed:', error);
        // Non-2xx so Paystack retries, per their own documented behavior.
        return new Response('Processing error', { status: 500 });
      }
    }
    if (socialUnlockId && data?.status === 'success') {
      try {
        const unlock = await getSocialUnlockById(env, socialUnlockId);
        // Same idempotency guard as the ad branch above -- markSocialUnlockPaid
        // itself also re-checks status internally, this is just the amount check.
        if (unlock && unlock.status === 'pending_payment' && Number(data.amount) === Number(unlock.amount_kobo)) {
          await markSocialUnlockPaid(env, socialUnlockId, data.reference);
        }
      } catch (error) {
        console.error('Webhook social unlock processing failed:', error);
        return new Response('Processing error', { status: 500 });
      }
    }
  }

  return json({ success: true });
}

async function handleActiveAd(request, env, ctx, slot) {
  if (!SLOT_CONFIG[slot]) return errorJson('Unknown placement.', 404);
  return readThroughCache(
    ctx,
    `https://lagoslife.stora.com.ng/__cache/active-ad/${slot}`,
    { freshTtl: 30, staleTtl: 300 },
    async () => {
      const ads = await getActiveAdsForSlot(env, slot);
      if (ads.length === 0) return json({ ad: null });
      // Deterministic time-bucket rotation, independent per slot -- each
      // position rotates through its own pool on its own schedule, rather
      // than every position showing the same advertiser at the same time.
      const bucket = Math.floor(Date.now() / (1000 * 60 * 3));
      const ad = ads[bucket % ads.length];
      return json({ ad: publicAd(ad) });
    }
  );
}

async function handleAdImage(env, adId) {
  const ad = await getAdById(env, adId);
  if (!ad) return new Response('Not found', { status: 404 });
  const object = await getObject(env, ad.image_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: { 'Content-Type': ad.image_content_type, 'Cache-Control': 'public, max-age=300' }
  });
}

// Public, unauthenticated -- avatars are meant to be visible to everyone
// on the leaderboard, unlike balance-proof screenshots (see r2.js).
async function handleGetAvatar(env, accountId) {
  const account = await env.DB.prepare(`SELECT avatar_key, avatar_content_type FROM accounts WHERE id = ?`)
    .bind(accountId).first();
  if (!account || !account.avatar_key) return new Response('Not found', { status: 404 });

  const object = await getObject(env, account.avatar_key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': account.avatar_content_type,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// Was Basic-Auth-username based; now attributes to the real signed-in
// admin's display name now that individual accounts exist.
function adminUsername(adminUser) {
  return adminUser?.display_name || adminUser?.email || 'admin';
}

function adminPageResponse(html) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' }
  });
}

async function getAdminSessionUser(request, env) {
  const token = readAdminSessionToken(request);
  if (!token) return null;
  return getAdminUserBySessionToken(env, token);
}

// Replaces requireBasicAuth for every day-to-day /admin* route now that
// real per-person accounts exist -- requireBasicAuth/ADMIN_SECRET stays
// wired to exactly one route (handleAdminSetup) as a one-time bootstrap
// credential, since creating the very first superadmin has no session to
// check against yet. Returns a Response (redirect to login, or 403) if
// not authorized for one of allowedRoles, else null -- same "null means
// go ahead" convention requireBasicAuth already used, so every call site
// below only needed its auth call swapped, not its control flow.
async function requireAdminRole(request, env, allowedRoles) {
  const adminUser = await getAdminSessionUser(request, env);
  if (!adminUser) {
    return Response.redirect(new URL('/admin/login', request.url).toString(), 303);
  }
  if (!allowedRoles.includes(adminUser.role)) {
    return new Response('Forbidden -- your role cannot access this page.', { status: 403 });
  }
  return null;
}

async function handleAdminOverview(request, env) {
  const adminUser = await getAdminSessionUser(request, env);
  if (!adminUser) return Response.redirect(new URL('/admin/login', request.url).toString(), 303);
  // agent/investor each have exactly one page -- land them there directly
  // instead of showing a stripped-down overview with links to pages they
  // can't open.
  if (adminUser.role === 'agent') return Response.redirect(new URL('/admin/submissions', request.url).toString(), 303);
  if (adminUser.role === 'investor') return Response.redirect(new URL('/admin/ads', request.url).toString(), 303);

  const [pendingEntries, pendingAds, activeCampaign] = await Promise.all([
    getPendingQueue(env),
    getPendingReviewAds(env),
    getActiveCampaign(env)
  ]);
  return adminPageResponse(renderOverviewPage({ pendingEntries, pendingAds, activeCampaign, adminUser }));
}

async function handleAdminSubmissionsPage(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin', 'agent']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const url = new URL(request.url);
  const view = url.searchParams.get('view') === 'approved' ? 'approved' : 'pending';
  let campaignFilter = url.searchParams.get('campaign');

  const [activeCampaign, lastEndedCampaign, recentCampaigns, pendingCount, pendingAds] = await Promise.all([
    getActiveCampaign(env),
    getLastEndedCampaign(env),
    getRecentCampaigns(env),
    countPendingEntries(env),
    getPendingReviewAds(env)
  ]);

  // Auto-default, no explicit ?campaign= yet: land on whichever campaign
  // is actually relevant right now (running, or the most recently ended
  // one) instead of making an admin re-pick this every visit -- only
  // one campaign is ever live at a time, so this is almost always the
  // right answer. "All campaigns" is still one click away via the filter.
  if (!campaignFilter) {
    campaignFilter = activeCampaign ? activeCampaign.id : (lastEndedCampaign ? lastEndedCampaign.id : 'all');
  }

  const entries = view === 'approved'
    ? await getApprovedEntries(env, campaignFilter, 100)
    : await getPendingQueue(env, campaignFilter);

  return adminPageResponse(renderSubmissionsPage({
    entries,
    view,
    campaignFilter,
    recentCampaigns,
    activeCampaignId: activeCampaign ? activeCampaign.id : null,
    pendingCount,
    pendingAdsCount: pendingAds.length,
    adminUser
  }));
}

async function handleAdminAdsPage(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin', 'investor']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const [pendingAds, pendingEntries, revenueBySlot, socialUnlockRevenue] = await Promise.all([
    getPendingReviewAds(env),
    getPendingQueue(env),
    getAdRevenueBySlot(env),
    getSocialUnlockRevenue(env)
  ]);
  // investor is revenue-only, read-only -- no pending-review queue/actions,
  // matching the exact scope confirmed with the user (see adminPage.js's
  // renderAdsPage for the resulting content split).
  return adminPageResponse(renderAdsPage(pendingAds, pendingEntries.length, revenueBySlot, socialUnlockRevenue, adminUser));
}

async function handleAdminCampaignsPage(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const [activeCampaign, recentCampaigns, pendingEntries, pendingAds] = await Promise.all([
    getActiveCampaign(env),
    getRecentCampaigns(env),
    getPendingQueue(env),
    getPendingReviewAds(env)
  ]);

  // entry_count for the active campaign is already in recentCampaigns
  // (it's always the most recently created row) -- no separate query.
  // The current leader DOES need its own lookup: getApprovedLeaderboard
  // already supports scoping to one campaign, just reused here with limit 1.
  let entryCount = 0;
  let topEntry = null;
  if (activeCampaign) {
    entryCount = recentCampaigns.find((c) => c.id === activeCampaign.id)?.entry_count ?? 0;
    const top = await getApprovedLeaderboard(env, 1, activeCampaign.id);
    topEntry = top[0] || null;
  }

  // Views: live for the active campaign, frozen (computed once, then
  // reused) for every ended one -- see ensureCampaignViews.
  const campaignsWithViews = await Promise.all(
    recentCampaigns.map(async (c) => ({ ...c, views: await ensureCampaignViews(env, c) }))
  );
  const activeViews = activeCampaign ? campaignsWithViews.find((c) => c.id === activeCampaign.id)?.views ?? null : null;

  return adminPageResponse(renderCampaignsPage({
    activeCampaign,
    activeViews,
    recentCampaigns: campaignsWithViews,
    entryCount,
    topEntry,
    pendingEntriesCount: pendingEntries.length,
    pendingAdsCount: pendingAds.length,
    adminUser
  }));
}

async function handleAdminStartCampaign(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const name = String(formData.get('name') || '').trim();
  const rewardDescription = String(formData.get('rewardDescription') || '').trim();
  if (!name) return new Response('Campaign name is required', { status: 400 });

  // Optional -- the modal's duration select posts seconds directly, or
  // an empty value for "no end date" (manual-only, today's behaviour).
  // Bounded to [1 hour, 90 days] so a typo can't create a campaign that
  // silently never ends (too small) or effectively never ends (too big).
  const rawDuration = String(formData.get('durationSeconds') || '').trim();
  let durationSeconds = null;
  if (rawDuration) {
    const parsed = Number(rawDuration);
    if (!Number.isFinite(parsed) || parsed < 3600 || parsed > 7776000) {
      return new Response('Invalid campaign duration', { status: 400 });
    }
    durationSeconds = parsed;
  }

  // Three mutually exclusive reveal modes -- 'immediate' (today's
  // original default), 'daily' (today's reveal/close-time mechanic), or
  // 'end' (new: completely withheld until the campaign itself ends, no
  // daily unlock at all). Enforced here, not just hidden in the admin
  // UI, so a stray revealTime/closeTime value can never leak through
  // alongside revealMode='end'.
  const revealMode = String(formData.get('revealMode') || 'immediate').trim();
  if (!['immediate', 'daily', 'end'].includes(revealMode)) {
    return new Response('Invalid reveal mode', { status: 400 });
  }
  const revealAtEnd = revealMode === 'end';

  // Optional -- an HTML time input (HH:MM, Lagos local time). Blank
  // keeps today's behaviour: submitting unlocks the leaderboard
  // immediately instead of waiting for a daily reveal moment.
  let revealSecondsOfDay = parseTimeOfDay(formData.get('revealTime'));
  if (revealSecondsOfDay === INVALID_TIME_OF_DAY) {
    return new Response('Invalid reveal time', { status: 400 });
  }
  if (revealMode === 'daily' && revealSecondsOfDay == null) {
    return new Response('Pick a daily reveal time, or choose a different reveal mode.', { status: 400 });
  }

  // Optional, and only meaningful alongside a reveal time -- turns the
  // "stays open the rest of the day" default into a tighter sneak-peek
  // window (revealed until this time, then re-gated until tomorrow's
  // reveal). Same-day only: must be strictly after the reveal time, no
  // overnight-wrapping window.
  let closeSecondsOfDay = parseTimeOfDay(formData.get('closeTime'));
  if (closeSecondsOfDay === INVALID_TIME_OF_DAY) {
    return new Response('Invalid close time', { status: 400 });
  }
  if (closeSecondsOfDay != null) {
    if (revealSecondsOfDay == null) {
      return new Response('A close time needs a reveal time to pair with', { status: 400 });
    }
    if (closeSecondsOfDay <= revealSecondsOfDay) {
      return new Response('Close time must be after the reveal time (same day)', { status: 400 });
    }
  }
  if (revealAtEnd) {
    // 'end' mode ignores whatever the (hidden, in this mode) daily-time
    // fields might still contain rather than erroring on them.
    revealSecondsOfDay = null;
    closeSecondsOfDay = null;
  }

  // Sponsors booked directly, filled in alongside campaign creation --
  // bypasses the self-serve payment flow entirely (see createSponsorAd).
  // Validated fully BEFORE the campaign is created, so a bad slot never
  // leaves a campaign half-created with no way to retry the sponsors.
  const maxImageBytes = Number(env.MAX_AD_IMAGE_BYTES || 3145728);
  const defaultSponsorKobo = Number(env.AD_PRICE_CAMPAIGN_BANNER_KOBO || 0);
  const sponsorSlots = [];
  for (let i = 1; i <= SLOT_CONFIG.campaign_banner.capacity; i++) {
    const logoFile = formData.get('sponsorLogo' + i);
    const linkUrl = String(formData.get('sponsorLink' + i) || '').trim();
    const hasFile = logoFile instanceof File && logoFile.size > 0;
    if (!hasFile && !linkUrl) continue; // slot left empty -- skip entirely

    if (!hasFile || !linkUrl) {
      return new Response(`Sponsor ${i}: both a logo and a link URL are required (or leave both blank).`, { status: 400 });
    }
    if (!AD_URL_RE.test(linkUrl) || linkUrl.length > 2048) {
      return new Response(`Sponsor ${i}: enter a valid link starting with http:// or https://.`, { status: 400 });
    }
    if (logoFile.size > maxImageBytes) {
      return new Response(`Sponsor ${i}: logo is too large.`, { status: 413 });
    }
    const bytes = new Uint8Array(await logoFile.arrayBuffer());
    const contentType = detectImageMimeType(bytes);
    if (!contentType) {
      return new Response(`Sponsor ${i}: that file does not look like a valid JPEG, PNG, or WebP image.`, { status: 400 });
    }
    const rawAmount = String(formData.get('sponsorAmount' + i) || '').trim();
    const amountKobo = rawAmount ? Math.round(Number(rawAmount) * 100) : defaultSponsorKobo;
    if (!Number.isFinite(amountKobo) || amountKobo < 0) {
      return new Response(`Sponsor ${i}: enter a valid amount.`, { status: 400 });
    }
    sponsorSlots.push({ bytes, contentType, linkUrl, amountKobo });
  }

  const campaign = await startCampaign(env, {
    name,
    rewardDescription: rewardDescription || null,
    createdBy: adminUsername(adminUser),
    durationSeconds,
    revealSecondsOfDay,
    closeSecondsOfDay,
    revealAtEnd
  });

  for (const sponsor of sponsorSlots) {
    const imageKey = `ads/${crypto.randomUUID()}.${extForContentType(sponsor.contentType)}`;
    try {
      await putObject(env, imageKey, sponsor.bytes, sponsor.contentType);
      await createSponsorAd(env, {
        campaignId: campaign.id,
        imageKey,
        imageContentType: sponsor.contentType,
        linkUrl: sponsor.linkUrl,
        amountKobo: sponsor.amountKobo,
        reviewedBy: adminUsername(adminUser)
      });
    } catch (error) {
      // The campaign itself already started successfully -- one sponsor
      // upload failing shouldn't fail the whole request. Add it after
      // via the normal ads flow if this happens.
      console.error('Failed to provision a sponsor for the new campaign:', error);
    }
  }

  return Response.redirect(new URL('/admin/campaigns', request.url).toString(), 303);
}

async function handleAdminEndCampaign(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;

  await endActiveCampaign(env);
  return Response.redirect(new URL('/admin/campaigns', request.url).toString(), 303);
}

async function handleAdminAnnouncementsPage(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const [announcements, pendingEntries, pendingAds] = await Promise.all([
    getAnnouncements(env),
    getPendingQueue(env),
    getPendingReviewAds(env)
  ]);
  return adminPageResponse(renderAdminAnnouncementsPage({
    announcements,
    pendingEntriesCount: pendingEntries.length,
    pendingAdsCount: pendingAds.length,
    adminUser
  }));
}

async function handleAdminCreateAnnouncement(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const title = String(formData.get('title') || '').trim();
  const body = String(formData.get('body') || '').trim();
  if (!title || !body) return new Response('Title and body are required', { status: 400 });
  if (title.length > 120 || body.length > 2000) return new Response('Title or body too long', { status: 400 });

  await createAnnouncement(env, { title, body, createdBy: adminUsername(adminUser) });
  return Response.redirect(new URL('/admin/announcements', request.url).toString(), 303);
}

async function handleAdminDeleteAnnouncement(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const id = String(formData.get('id') || '').trim();
  if (id) await deleteAnnouncement(env, id);
  return Response.redirect(new URL('/admin/announcements', request.url).toString(), 303);
}

async function handleAdminAdImage(request, env, id) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;

  const ad = await getAdById(env, id);
  if (!ad) return new Response('Not found', { status: 404 });
  const object = await getObject(env, ad.image_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: { 'Content-Type': ad.image_content_type, 'Cache-Control': 'private, no-store' }
  });
}

async function handleAdminAdReview(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  const action = String(formData.get('action') || '');
  const reason = String(formData.get('reason') || '').trim();

  if (!id || !['approve', 'reject'].includes(action)) {
    return new Response('Bad request', { status: 400 });
  }

  if (action === 'approve') {
    await approveAd(env, id, adminUsername(adminUser));
  } else {
    await rejectAd(env, id, adminUsername(adminUser), reason);
  }

  return Response.redirect(new URL('/admin/ads', request.url).toString(), 303);
}

async function handleAdminScreenshot(request, env, id) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin', 'agent']);
  if (unauthorized) return unauthorized;

  const entry = await getEntryById(env, id);
  if (!entry) return new Response('Not found', { status: 404 });

  const object = await getObject(env, entry.screenshot_key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': entry.screenshot_content_type,
      'Cache-Control': 'private, no-store'
    }
  });
}

async function handleAdminReview(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin', 'agent']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  const action = String(formData.get('action') || '');
  const reason = String(formData.get('reason') || '').trim();

  if (!id || !['approve', 'reject'].includes(action)) {
    return new Response('Bad request', { status: 400 });
  }

  await reviewEntry(env, id, {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewedBy: adminUsername(adminUser),
    rejectionReason: action === 'reject' ? (reason || null) : null
  });

  // No explicit cache purge here -- the Cache API has no global purge from
  // a Worker, and the leaderboard JSON's own TTL (see cache.js) means an
  // approval becomes visible within one refresh cycle, which was already
  // accepted as fine.
  return Response.redirect(new URL('/admin/submissions', request.url).toString(), 303);
}

// -- Admin login/logout, bootstrap, and account management ----------------

async function handleAdminLoginPage(request, env) {
  const adminUser = await getAdminSessionUser(request, env);
  if (adminUser) return Response.redirect(new URL('/admin', request.url).toString(), 303);
  const url = new URL(request.url);
  return adminPageResponse(renderAdminLoginPage({ error: url.searchParams.get('error') === '1' }));
}

async function handleAdminLogin(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.AUTH_FLOOD_LIMITER.limit({ key: `admin:${clientIp}` });
    if (!success) return Response.redirect(new URL('/admin/login?error=1', request.url).toString(), 303);
  } catch (error) {
    console.error('Auth flood limiter check failed, allowing request:', error);
  }

  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const loginFailed = () => Response.redirect(new URL('/admin/login?error=1', request.url).toString(), 303);
  if (!EMAIL_RE.test(email) || !password) return loginFailed();

  const adminUser = await getAdminUserByEmail(env, email);
  if (!adminUser || adminUser.disabled_at) return loginFailed();

  const ok = await verifyPassword(password, adminUser.password_salt, adminUser.password_hash);
  if (!ok) return loginFailed();

  const token = generateSessionToken();
  await createAdminSession(env, token, adminUser.id, ADMIN_SESSION_TTL_SECONDS);

  return new Response(null, {
    status: 303,
    headers: { Location: new URL('/admin', request.url).toString(), 'Set-Cookie': adminSessionCookieHeader(token) }
  });
}

async function handleAdminLogout(request, env) {
  const token = readAdminSessionToken(request);
  if (token) await deleteAdminSession(env, token);
  return new Response(null, {
    status: 303,
    headers: { Location: new URL('/admin/login', request.url).toString(), 'Set-Cookie': clearAdminSessionCookieHeader() }
  });
}

// One-time bootstrap: creates the very first superadmin account. Gated
// by the legacy ADMIN_SECRET Basic Auth (there's no admin session to
// check against yet) AND by admin_users being completely empty -- once
// any account exists, this route permanently 404s, so it can never be
// used as a standing backdoor alongside the real login.
// ADMIN_SECRET itself had no throttle on guessing attempts before this --
// requireBasicAuth's timing-safe compare blocks a timing side-channel but
// not repeated guessing. Reuses AUTH_FLOOD_LIMITER (separate bucket via
// the "setup:" key prefix, same pattern as admin login's "admin:" prefix)
// rather than a dedicated limiter, since this route is rarely hit at all
// in normal operation.
async function checkSetupFlood(request, env) {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.AUTH_FLOOD_LIMITER.limit({ key: `setup:${clientIp}` });
    if (!success) return new Response('Too many requests.', { status: 429 });
  } catch (error) {
    console.error('Auth flood limiter check failed, allowing request:', error);
  }
  return null;
}

async function handleAdminSetupPage(request, env) {
  const flooded = await checkSetupFlood(request, env);
  if (flooded) return flooded;
  const unauthorized = requireBasicAuth(request, env);
  if (unauthorized) return unauthorized;
  const existing = await countAdminUsers(env);
  if (existing > 0) return new Response('Not found', { status: 404 });
  return adminPageResponse(renderAdminSetupPage({}));
}

async function handleAdminSetup(request, env) {
  const flooded = await checkSetupFlood(request, env);
  if (flooded) return flooded;
  const unauthorized = requireBasicAuth(request, env);
  if (unauthorized) return unauthorized;
  const existing = await countAdminUsers(env);
  if (existing > 0) return new Response('Not found', { status: 404 });

  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '').trim();
  if (!EMAIL_RE.test(email)) return new Response('Enter a valid email address', { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) return new Response(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, { status: 400 });
  if (!displayName || displayName.length > 60) return new Response('Enter a display name (max 60 characters)', { status: 400 });

  const { hash, salt } = await derivePasswordHash(password);
  const adminUser = await createAdminUser(env, { email, passwordHash: hash, passwordSalt: salt, displayName, role: 'superadmin', createdBy: null });
  if (!adminUser) return new Response('That email is already in use', { status: 409 });

  const token = generateSessionToken();
  await createAdminSession(env, token, adminUser.id, ADMIN_SESSION_TTL_SECONDS);
  return new Response(null, {
    status: 303,
    headers: { Location: new URL('/admin', request.url).toString(), 'Set-Cookie': adminSessionCookieHeader(token) }
  });
}

async function handleAdminUsersPage(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const [admins, pendingEntries, pendingAds] = await Promise.all([
    listAdminUsers(env),
    getPendingQueue(env),
    getPendingReviewAds(env)
  ]);
  return adminPageResponse(renderAdminUsersPage({
    admins,
    pendingEntriesCount: pendingEntries.length,
    pendingAdsCount: pendingAds.length,
    adminUser
  }));
}

async function handleAdminCreateUser(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '').trim();
  const role = String(formData.get('role') || '');
  if (!EMAIL_RE.test(email)) return new Response('Enter a valid email address', { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) return new Response(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, { status: 400 });
  if (!displayName || displayName.length > 60) return new Response('Enter a display name (max 60 characters)', { status: 400 });
  if (!['superadmin', 'agent', 'investor'].includes(role)) return new Response('Invalid role', { status: 400 });

  const { hash, salt } = await derivePasswordHash(password);
  const created = await createAdminUser(env, { email, passwordHash: hash, passwordSalt: salt, displayName, role, createdBy: adminUser.id });
  if (!created) return new Response('That email is already in use', { status: 409 });
  return Response.redirect(new URL('/admin/users', request.url).toString(), 303);
}

async function handleAdminToggleUser(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  const disable = String(formData.get('disable') || '') === '1';
  if (!id) return new Response('Bad request', { status: 400 });

  // Guard rails: never let an admin disable their own account (accidental
  // self-lockout mid-session), and never let the last active superadmin
  // be disabled (would permanently lock everyone out of account
  // management -- /admin/setup only works while admin_users is empty).
  if (disable && id === adminUser.id) {
    return new Response('You cannot disable your own account', { status: 400 });
  }
  const target = await getAdminUserById(env, id);
  if (!target) return new Response('Not found', { status: 404 });
  if (disable && target.role === 'superadmin') {
    const activeSuperadmins = await countActiveSuperadmins(env);
    if (activeSuperadmins <= 1) {
      return new Response('Cannot disable the last active superadmin', { status: 400 });
    }
  }

  await setAdminUserDisabled(env, id, disable);
  return Response.redirect(new URL('/admin/users', request.url).toString(), 303);
}

async function handleAdminChangeRole(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  const role = String(formData.get('role') || '');
  if (!id || !['superadmin', 'agent', 'investor'].includes(role)) {
    return new Response('Bad request', { status: 400 });
  }
  // Same self-action guard as disabling -- changing your own role could
  // lock you out of the page you're using to change it.
  if (id === adminUser.id) {
    return new Response('You cannot change your own role', { status: 400 });
  }
  const target = await getAdminUserById(env, id);
  if (!target) return new Response('Not found', { status: 404 });
  if (target.role === 'superadmin' && role !== 'superadmin' && !target.disabled_at) {
    const activeSuperadmins = await countActiveSuperadmins(env);
    if (activeSuperadmins <= 1) {
      return new Response('Cannot demote the last active superadmin', { status: 400 });
    }
  }

  await setAdminUserRole(env, id, role);
  return Response.redirect(new URL('/admin/users', request.url).toString(), 303);
}

async function handleAdminDeleteUser(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  if (!id) return new Response('Bad request', { status: 400 });
  if (id === adminUser.id) {
    return new Response('You cannot delete your own account', { status: 400 });
  }
  const target = await getAdminUserById(env, id);
  if (!target) return new Response('Not found', { status: 404 });
  if (target.role === 'superadmin' && !target.disabled_at) {
    const activeSuperadmins = await countActiveSuperadmins(env);
    if (activeSuperadmins <= 1) {
      return new Response('Cannot delete the last active superadmin', { status: 400 });
    }
  }

  await deleteAdminUser(env, id);
  return Response.redirect(new URL('/admin/users', request.url).toString(), 303);
}

async function handleAdminResetPassword(request, env) {
  const unauthorized = await requireAdminRole(request, env, ['superadmin']);
  if (unauthorized) return unauthorized;
  const adminUser = await getAdminSessionUser(request, env);

  const formData = await request.formData();
  const id = String(formData.get('id') || '');
  const password = String(formData.get('password') || '');
  if (!id) return new Response('Bad request', { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return new Response(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, { status: 400 });
  }
  const target = await getAdminUserById(env, id);
  if (!target) return new Response('Not found', { status: 404 });

  const { hash, salt } = await derivePasswordHash(password);
  await setAdminUserPassword(env, id, hash, salt);
  // Signs the target out everywhere -- a session from before the reset
  // must not keep working under the old password's trust.
  await deleteAdminSessionsForUser(env, id);

  // Resetting your OWN password would otherwise also kill the session
  // making this very request -- re-issue one immediately so the acting
  // superadmin isn't unexpectedly logged out by their own action.
  if (id === adminUser.id) {
    const token = generateSessionToken();
    await createAdminSession(env, token, adminUser.id, ADMIN_SESSION_TTL_SECONDS);
    return new Response(null, {
      status: 303,
      headers: { Location: new URL('/admin/users', request.url).toString(), 'Set-Cookie': adminSessionCookieHeader(token) }
    });
  }

  return Response.redirect(new URL('/admin/users', request.url).toString(), 303);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'GET' && pathname === '/') {
      return handleRoot(request, env, ctx);
    }
    if (method === 'GET' && pathname === '/og-image.jpg') {
      return handleOgImage();
    }
    if (method === 'GET' && pathname === '/api/leaderboard') {
      return handleLeaderboard(request, env, ctx);
    }
    if (method === 'POST' && pathname === '/api/submit') {
      return handleSubmit(request, env);
    }
    const entryMatch = pathname.match(/^\/api\/entry\/([^/]+)$/);
    if (method === 'GET' && entryMatch) {
      return handleGetEntry(env, decodeURIComponent(entryMatch[1]));
    }
    if (method === 'POST' && pathname === '/api/presence/ping') {
      return handlePresencePing(request, env);
    }
    if (method === 'GET' && pathname === '/api/presence/stats') {
      return handlePresenceStats(request, env, ctx);
    }
    if (method === 'POST' && pathname === '/api/auth/signup') {
      return handleSignup(request, env);
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      return handleLogin(request, env);
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      return handleLogout(request, env);
    }
    if (method === 'GET' && pathname === '/api/auth/me') {
      return handleMe(request, env);
    }
    if (method === 'POST' && pathname === '/api/account/profile') {
      return handleUpdateProfile(request, env);
    }
    if (method === 'POST' && pathname === '/api/account/avatar') {
      return handleUpdateAvatar(request, env);
    }
    const avatarMatch = pathname.match(/^\/avatar\/([^/]+)$/);
    if (method === 'GET' && avatarMatch) {
      return handleGetAvatar(env, decodeURIComponent(avatarMatch[1]));
    }
    if (method === 'GET' && pathname === '/api/campaign/status') {
      return handleCampaignStatus(request, env);
    }
    if (method === 'GET' && pathname === '/announcements') {
      return handleAnnouncementsPage(request, env, ctx);
    }
    if (method === 'GET' && pathname === '/api/announcements') {
      return handleAnnouncementsApi(request, env, ctx);
    }
    if (method === 'GET' && pathname === '/campaigns') {
      return handlePastCampaignsPage(request, env, ctx);
    }
    if (method === 'GET' && pathname === '/api/campaigns/past') {
      return handlePastCampaignsApi(request, env, ctx);
    }

    if (method === 'POST' && pathname === '/api/ads/create') {
      return handleCreateAd(request, env);
    }
    const payAdMatch = pathname.match(/^\/api\/ads\/([^/]+)\/pay$/);
    if (method === 'POST' && payAdMatch) {
      return handlePayForAd(request, env, decodeURIComponent(payAdMatch[1]));
    }
    const confirmAdMatch = pathname.match(/^\/api\/ads\/([^/]+)\/confirm$/);
    if (method === 'GET' && confirmAdMatch) {
      return handleConfirmAdPayment(request, env, decodeURIComponent(confirmAdMatch[1]));
    }
    const activeAdMatch = pathname.match(/^\/api\/ads\/active\/([^/]+)$/);
    if (method === 'GET' && activeAdMatch) {
      return handleActiveAd(request, env, ctx, decodeURIComponent(activeAdMatch[1]));
    }
    const adImageMatch = pathname.match(/^\/ads\/image\/([^/]+)$/);
    if (method === 'GET' && adImageMatch) {
      return handleAdImage(env, decodeURIComponent(adImageMatch[1]));
    }
    if (method === 'POST' && pathname === '/api/webhooks/paystack') {
      return handlePaystackWebhook(request, env);
    }
    if (method === 'POST' && pathname === '/api/social-unlock/create') {
      return handleCreateSocialUnlock(request, env);
    }
    const confirmSocialUnlockMatch = pathname.match(/^\/api\/social-unlock\/([^/]+)\/confirm$/);
    if (method === 'GET' && confirmSocialUnlockMatch) {
      return handleConfirmSocialUnlock(request, env, decodeURIComponent(confirmSocialUnlockMatch[1]));
    }

    if (method === 'GET' && pathname === '/admin') {
      return handleAdminOverview(request, env);
    }
    if (method === 'GET' && pathname === '/admin/submissions') {
      return handleAdminSubmissionsPage(request, env);
    }
    if (method === 'GET' && pathname === '/admin/ads') {
      return handleAdminAdsPage(request, env);
    }
    if (method === 'GET' && pathname === '/admin/campaigns') {
      return handleAdminCampaignsPage(request, env);
    }
    if (method === 'GET' && pathname === '/admin/announcements') {
      return handleAdminAnnouncementsPage(request, env);
    }
    const screenshotMatch = pathname.match(/^\/admin\/screenshot\/([^/]+)$/);
    if (method === 'GET' && screenshotMatch) {
      return handleAdminScreenshot(request, env, decodeURIComponent(screenshotMatch[1]));
    }
    const adminAdImageMatch = pathname.match(/^\/admin\/ads\/image\/([^/]+)$/);
    if (method === 'GET' && adminAdImageMatch) {
      return handleAdminAdImage(request, env, decodeURIComponent(adminAdImageMatch[1]));
    }
    if (method === 'POST' && pathname === '/api/admin/review') {
      return handleAdminReview(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/ads/review') {
      return handleAdminAdReview(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/campaigns/start') {
      return handleAdminStartCampaign(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/campaigns/end') {
      return handleAdminEndCampaign(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/announcements/create') {
      return handleAdminCreateAnnouncement(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/announcements/delete') {
      return handleAdminDeleteAnnouncement(request, env);
    }
    if (method === 'GET' && pathname === '/admin/login') {
      return handleAdminLoginPage(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/login') {
      return handleAdminLogin(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/logout') {
      return handleAdminLogout(request, env);
    }
    if (method === 'GET' && pathname === '/admin/setup') {
      return handleAdminSetupPage(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/setup') {
      return handleAdminSetup(request, env);
    }
    if (method === 'GET' && pathname === '/admin/users') {
      return handleAdminUsersPage(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/users/create') {
      return handleAdminCreateUser(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/users/toggle') {
      return handleAdminToggleUser(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/users/change-role') {
      return handleAdminChangeRole(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/users/delete') {
      return handleAdminDeleteUser(request, env);
    }
    if (method === 'POST' && pathname === '/api/admin/users/reset-password') {
      return handleAdminResetPassword(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};
