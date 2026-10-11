// All D1 access for the entries table. Queries are written against the
// indexes in migrations/0001_init.sql -- keep the two in sync if either
// changes.

const ONE_HOUR_SECONDS = 60 * 60;

export async function hashIp(env, ip) {
  const salt = env.IP_HASH_SALT || '';
  const data = new TextEncoder().encode(`${salt}${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// LEFT JOINed with accounts so the leaderboard can show a real uploaded
// avatar for entries tied to an account, falling back to the client's
// generated initials circle (see publicPage.js) when has_avatar is 0/null
// -- an anonymous (pre-login) submission has no account_id at all.
//
// campaignId: when given, scopes to just that campaign's entries (the
// gated, fresh-competition view while a campaign is running); when
// omitted, returns every approved entry regardless of campaign (the
// resting-state, all-time leaderboard -- a past campaign's entries don't
// disappear once it ends, campaign_id is provenance, not an exclusion
// filter outside of active gating).
// Social handles are only ever SELECTed when social_unlock_ends_at is
// still in the future -- enforced here in the query itself (CASE WHEN),
// not just hidden client-side, same "the data never leaves the server
// when it shouldn't" principle already applied to the campaign reveal
// embargo. An account with no active unlock gets NULL for all three,
// indistinguishable from never having set them at all.
export async function getApprovedLeaderboard(env, limit = 100, campaignId = null) {
  const campaignClause = campaignId ? 'AND e.campaign_id = ?' : '';
  const now = Math.floor(Date.now() / 1000);
  const stmt = env.DB.prepare(
    `SELECT e.id, e.display_name, e.lagos_life_handle, e.reported_balance, e.created_at,
            e.account_id, (a.avatar_key IS NOT NULL) AS has_avatar,
            CASE WHEN a.social_unlock_ends_at > ? THEN a.instagram_handle END AS instagram_handle,
            CASE WHEN a.social_unlock_ends_at > ? THEN a.tiktok_handle END AS tiktok_handle,
            CASE WHEN a.social_unlock_ends_at > ? THEN a.twitter_handle END AS twitter_handle,
            CASE WHEN a.social_unlock_ends_at > ? THEN a.snapchat_handle END AS snapchat_handle
     FROM entries e LEFT JOIN accounts a ON a.id = e.account_id
     WHERE e.status = 'approved' ${campaignClause}
     ORDER BY e.reported_balance DESC
     LIMIT ?`
  );
  const { results } = campaignId
    ? await stmt.bind(now, now, now, now, campaignId, limit).all()
    : await stmt.bind(now, now, now, now, limit).all();
  return results;
}

// campaignFilter: null/undefined/'all' -- unfiltered (every existing
// caller besides the admin Submissions page itself relies on this, for
// their own sidebar badge counts); 'none' -- only entries submitted
// while no campaign was running; a campaign id -- scoped to just that
// campaign. Always joins the campaign name too (not just id) so a
// merged ("all") view can label each row -- harmless extra columns for
// callers that ignore them.
export async function getPendingQueue(env, campaignFilter = null) {
  const binds = [];
  let campaignClause = '';
  if (campaignFilter === 'none') {
    campaignClause = 'AND e.campaign_id IS NULL';
  } else if (campaignFilter && campaignFilter !== 'all') {
    campaignClause = 'AND e.campaign_id = ?';
    binds.push(campaignFilter);
  }
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.display_name, e.lagos_life_handle, e.reported_balance, e.screenshot_content_type, e.created_at,
            e.campaign_id, c.name AS campaign_name
     FROM entries e LEFT JOIN campaigns c ON c.id = e.campaign_id
     WHERE e.status = 'pending' ${campaignClause}
     ORDER BY e.created_at ASC`
  ).bind(...binds).all();
  return results;
}

// Cheap global count (no row fetch) -- backs the sidebar "Submissions"
// badge, which should always reflect every pending entry regardless of
// whatever campaign filter the Submissions page itself is currently
// scoped to.
export async function countPendingEntries(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM entries WHERE status = 'pending'`).first();
  return row?.n || 0;
}

// Backs the admin Submissions page's new read-only "Approved" view --
// same campaign-scoping convention as getPendingQueue above. Newest-
// reviewed first (an audit log, not a triage queue), capped at `limit`
// since this only ever grows.
export async function getApprovedEntries(env, campaignFilter = null, limit = 100) {
  const binds = [];
  let campaignClause = '';
  if (campaignFilter === 'none') {
    campaignClause = 'AND e.campaign_id IS NULL';
  } else if (campaignFilter && campaignFilter !== 'all') {
    campaignClause = 'AND e.campaign_id = ?';
    binds.push(campaignFilter);
  }
  binds.push(limit);
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.display_name, e.lagos_life_handle, e.reported_balance, e.screenshot_content_type,
            e.created_at, e.reviewed_by, e.reviewed_at, e.campaign_id, c.name AS campaign_name
     FROM entries e LEFT JOIN campaigns c ON c.id = e.campaign_id
     WHERE e.status = 'approved' ${campaignClause}
     ORDER BY e.reviewed_at DESC, e.created_at DESC
     LIMIT ?`
  ).bind(...binds).all();
  return results;
}

// Fails CLOSED by design (callers must treat a thrown error as "reject the
// submission") -- unlike the SUBMIT_FLOOD_LIMITER binding's fail-open
// convention, this is the real anti-abuse throttle for the one mutating
// endpoint, so a D1 error here must never silently allow unlimited writes.
export async function countRecentSubmissionsByIpHash(env, ipHash) {
  const cutoff = Math.floor(Date.now() / 1000) - ONE_HOUR_SECONDS;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM entries WHERE submitter_ip_hash = ? AND created_at > ?`
  ).bind(ipHash, cutoff).first();
  return row?.count ?? 0;
}

export async function insertPendingEntry(env, entry) {
  await env.DB.prepare(
    `INSERT INTO entries
       (id, display_name, lagos_life_handle, reported_balance, screenshot_key, screenshot_content_type, submitter_ip_hash, account_id, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    entry.id,
    entry.displayName,
    entry.lagosLifeHandle,
    entry.reportedBalance,
    entry.screenshotKey,
    entry.screenshotContentType,
    entry.submitterIpHash,
    entry.accountId || null,
    entry.campaignId || null
  ).run();
}

// -- Campaigns -------------------------------------------------------------

// Lazily auto-ends a campaign once its scheduled ends_at passes -- no
// cron trigger needed (this app has none); every caller already goes
// through this one function to find the active campaign, so the
// transition happens the next time anyone checks, same pattern as how
// an ad's ends_at is just a time filter rather than a background job.
export async function getActiveCampaign(env) {
  const campaign = await env.DB.prepare(`SELECT * FROM campaigns WHERE status = 'active' LIMIT 1`).first();
  if (!campaign) return null;
  if (campaign.ends_at && campaign.ends_at <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare(
      `UPDATE campaigns SET status = 'ended', ended_at = ? WHERE id = ?`
    ).bind(campaign.ends_at, campaign.id).run();
    return null;
  }
  return campaign;
}

// Ends whatever's currently active (if anything) before starting the new
// one, so at most one campaign is ever active and two campaigns can run
// back-to-back with zero gap in a single admin action. durationSeconds
// and revealSecondsOfDay are both optional -- omit durationSeconds for a
// campaign that runs until a staffer ends it manually (today's original
// behaviour), and omit revealSecondsOfDay for one where submitting
// unlocks the leaderboard immediately (also today's original behaviour).
export async function startCampaign(env, { name, rewardDescription, createdBy, durationSeconds, revealSecondsOfDay, closeSecondsOfDay, revealAtEnd }) {
  const current = await getActiveCampaign(env);
  if (current) {
    await env.DB.prepare(
      `UPDATE campaigns SET status = 'ended', ended_at = unixepoch() WHERE id = ?`
    ).bind(current.id).run();
  }
  const id = crypto.randomUUID();
  const endsAt = durationSeconds ? Math.floor(Date.now() / 1000) + durationSeconds : null;
  await env.DB.prepare(
    `INSERT INTO campaigns (id, name, reward_description, created_by, ends_at, reveal_seconds_of_day, close_seconds_of_day, reveal_at_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, name, rewardDescription || null, createdBy || null, endsAt,
    revealAtEnd ? null : (revealSecondsOfDay != null ? revealSecondsOfDay : null),
    revealAtEnd ? null : (closeSecondsOfDay != null ? closeSecondsOfDay : null),
    revealAtEnd ? 1 : 0
  ).run();
  return env.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`).bind(id).first();
}

export async function endActiveCampaign(env) {
  const current = await getActiveCampaign(env);
  if (!current) return null;
  await env.DB.prepare(
    `UPDATE campaigns SET status = 'ended', ended_at = unixepoch() WHERE id = ?`
  ).bind(current.id).run();
  return current;
}

// Backs the Campaigns admin page's history list -- newest first, active
// campaign (if any) included alongside past ones, each with how many
// entries it drew.
export async function getRecentCampaigns(env, limit = 20) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, COUNT(e.id) AS entry_count
     FROM campaigns c LEFT JOIN entries e ON e.campaign_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT ?`
  ).bind(limit).all();
  return results;
}

// Freezes a campaign's view count once computed -- see
// ensureCampaignViews (src/index.js) for when/why this is called.
export async function setCampaignViews(env, id, viewsCount) {
  await env.DB.prepare(`UPDATE campaigns SET views_count = ? WHERE id = ?`).bind(viewsCount, id).run();
}

// Backs the public leaderboard's "waiting period" state (see
// handleLeaderboard/handleCampaignStatus): once a campaign ends and
// before the next one starts, the board freezes on this campaign's
// results instead of silently widening to every approved entry ever
// submitted.
export async function getLastEndedCampaign(env) {
  return env.DB.prepare(
    `SELECT * FROM campaigns WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 1`
  ).first();
}

// Backs the public /campaigns page -- every ended campaign, newest
// first, alongside its winning entry. Reuses getApprovedLeaderboard
// (limit 1, scoped to that campaign) so a winner is held to the exact
// same approved-only, unlock-gated view as the live board -- no
// separate/looser query for "who won".
export async function getPastCampaignsWithWinners(env, limit = 20) {
  const { results: campaigns } = await env.DB.prepare(
    `SELECT id, name, reward_description, started_at, ended_at
     FROM campaigns WHERE status = 'ended' ORDER BY ended_at DESC LIMIT ?`
  ).bind(limit).all();
  return Promise.all(campaigns.map(async (c) => {
    const top = await getApprovedLeaderboard(env, 1, c.id);
    return { ...c, winner: top[0] || null };
  }));
}

// "Once per campaign" check -- only meaningful for a logged-in account
// (an anonymous submitter has no durable identity to dedupe against; see
// src/index.js for why that's an accepted gap, not an oversight).
export async function hasAccountEnteredCampaign(env, campaignId, accountId) {
  if (!accountId) return false;
  const row = await env.DB.prepare(
    `SELECT 1 AS found FROM entries WHERE campaign_id = ? AND account_id = ? LIMIT 1`
  ).bind(campaignId, accountId).first();
  return !!row;
}

export async function getEntryById(env, id) {
  return env.DB.prepare(`SELECT * FROM entries WHERE id = ?`).bind(id).first();
}

// Public-safe lookup for "my entry" (GET /api/entry/:id) -- the id is a
// crypto.randomUUID(), unguessable, so the route itself needs no auth,
// but this still only selects display-safe columns (no submitter_ip_hash).
// Rank is only meaningful once approved -- a pending/rejected entry isn't
// on the public leaderboard at all, so `rank` comes back null for those.
// Also returns the entry's own campaign's status/reveal fields (when it
// has one) -- NOT applied here, since whether a reveal gate should
// withhold the rank is request-time policy (isCampaignRevealedNow lives
// in src/index.js, which already owns this decision for the main
// leaderboard). This just hands the caller what it needs to decide.
export async function getEntryWithRank(env, id) {
  const entry = await env.DB.prepare(
    `SELECT e.id, e.display_name, e.lagos_life_handle, e.reported_balance, e.status, e.rejection_reason, e.created_at,
            e.campaign_id, c.status AS campaign_status, c.reveal_seconds_of_day, c.close_seconds_of_day, c.reveal_at_end
     FROM entries e LEFT JOIN campaigns c ON c.id = e.campaign_id
     WHERE e.id = ?`
  ).bind(id).first();
  if (!entry) return null;
  if (entry.status !== 'approved') return { ...entry, rank: null };

  // Rank = 1 + how many approved entries have a strictly higher balance,
  // scoped to the SAME campaign this entry belongs to (or to other
  // campaign-less entries, if this one has none) -- matches exactly how
  // getApprovedLeaderboard ranks the real public board, so this never
  // disagrees with what everyone else sees. Ties share a rank rather
  // than getting an arbitrary tiebreak order.
  const campaignClause = entry.campaign_id ? 'AND campaign_id = ?' : 'AND campaign_id IS NULL';
  const binds = entry.campaign_id ? [entry.reported_balance, entry.campaign_id] : [entry.reported_balance];
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS higher FROM entries WHERE status = 'approved' AND reported_balance > ? ${campaignClause}`
  ).bind(...binds).first();
  return { ...entry, rank: (row?.higher ?? 0) + 1 };
}

export async function reviewEntry(env, id, { status, reviewedBy, rejectionReason }) {
  await env.DB.prepare(
    `UPDATE entries
     SET status = ?, reviewed_by = ?, reviewed_at = unixepoch(), rejection_reason = ?, updated_at = unixepoch()
     WHERE id = ?`
  ).bind(status, reviewedBy, rejectionReason || null, id).run();
}

// -- Accounts, password auth, sessions --------------------------------

// Returns the new account row, or null if the email is already registered
// (caught via the UNIQUE constraint rather than a separate pre-check
// query, so a race between two concurrent signups for the same email
// can't create two rows).
export async function createAccount(env, email, passwordHash, passwordSalt, displayName, lagosLifeHandle) {
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, display_name, lagos_life_handle) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, email, passwordHash, passwordSalt, displayName, lagosLifeHandle).run();
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) return null;
    throw error;
  }
  return env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`).bind(id).first();
}

export async function getAccountByEmail(env, email) {
  return env.DB.prepare(`SELECT * FROM accounts WHERE email = ?`).bind(email).first();
}

export async function updateAccountProfile(env, accountId, { displayName, lagosLifeHandle, instagramHandle, tiktokHandle, twitterHandle, snapchatHandle }) {
  await env.DB.prepare(
    `UPDATE accounts
     SET display_name = ?, lagos_life_handle = ?, instagram_handle = ?, tiktok_handle = ?, twitter_handle = ?, snapchat_handle = ?, updated_at = unixepoch()
     WHERE id = ?`
  ).bind(displayName, lagosLifeHandle, instagramHandle, tiktokHandle, twitterHandle, snapchatHandle, accountId).run();
}

export async function updateAccountAvatar(env, accountId, avatarKey, avatarContentType) {
  await env.DB.prepare(
    `UPDATE accounts SET avatar_key = ?, avatar_content_type = ?, updated_at = unixepoch() WHERE id = ?`
  ).bind(avatarKey, avatarContentType, accountId).run();
}

export async function createSession(env, token, accountId, ttlSeconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await env.DB.prepare(
    `INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, accountId, expiresAt).run();
}

export async function deleteSession(env, token) {
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
}

// Returns the account row for a valid, unexpired session token, or null.
// A lazily-expired row (past expires_at but not yet cleaned up) is
// treated as absent rather than actively deleted here -- no cron/cleanup
// job exists in this Worker, so stale rows are left for a future
// migration or scheduled task to sweep; they're harmless dead weight
// until then since this query already excludes them from ever granting
// access.
export async function getAccountBySessionToken(env, token) {
  return env.DB.prepare(
    `SELECT a.* FROM sessions s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.token = ? AND s.expires_at > unixepoch()`
  ).bind(token).first();
}

// The account's submission history, newest first -- backs both the
// profile card's stat row (entries[0], the "current" one) and the
// "Recent submissions" list below it. Each gets the same per-entry rank
// computation getEntryWithRank uses for the anonymous/localStorage path;
// cheap enough at this `limit` to do per-row rather than one bulk query.
// Same campaign-scoped rank + reveal-fields shape as getEntryWithRank --
// see that function's comment for why both matter here too (this backs
// the logged-in Profile tab's stats/history, the other backs the
// anonymous "Your rank" chip).
export async function getEntriesForAccount(env, accountId, limit = 5) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.display_name, e.lagos_life_handle, e.reported_balance, e.status, e.rejection_reason, e.created_at,
            e.campaign_id, c.status AS campaign_status, c.reveal_seconds_of_day, c.close_seconds_of_day, c.reveal_at_end
     FROM entries e LEFT JOIN campaigns c ON c.id = e.campaign_id
     WHERE e.account_id = ? ORDER BY e.created_at DESC LIMIT ?`
  ).bind(accountId, limit).all();

  const withRanks = [];
  for (const entry of results) {
    if (entry.status !== 'approved') {
      withRanks.push({ ...entry, rank: null });
      continue;
    }
    const campaignClause = entry.campaign_id ? 'AND campaign_id = ?' : 'AND campaign_id IS NULL';
    const binds = entry.campaign_id ? [entry.reported_balance, entry.campaign_id] : [entry.reported_balance];
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS higher FROM entries WHERE status = 'approved' AND reported_balance > ? ${campaignClause}`
    ).bind(...binds).first();
    withRanks.push({ ...entry, rank: (row?.higher ?? 0) + 1 });
  }
  return withRanks;
}

// Live + all-time visitor counts live in the PresenceCounter Durable
// Object (src/presenceObject.js), not here -- that workload (tiny,
// extremely frequent read/writes from every open tab) is exactly what a
// DO's in-memory/embedded-SQLite model is built for, and D1 would become
// the bottleneck at real traffic long before the DO would.

// -- Self-serve ads -------------------------------------------------------

const AD_DURATION_DAYS = { day: 1, week: 7, month: 30 };
// campaign_banner ads don't have an advertiser-chosen duration -- they run
// for as long as the campaign they sponsor does, which the display query
// below enforces directly (joining on campaigns.status). This is just a
// generous outer bound so `ends_at` is never null.
const CAMPAIGN_BANNER_FALLBACK_DAYS = 90;

export async function createPendingAd(env, { id, accountId, slot, campaignId, imageKey, imageContentType, linkUrl, pkg, amountKobo }) {
  await env.DB.prepare(
    `INSERT INTO ads (id, account_id, slot, campaign_id, image_key, image_content_type, link_url, package, amount_kobo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, slot, campaignId || null, imageKey, imageContentType, linkUrl, pkg, amountKobo).run();
}

// A sponsor booked directly by staff (see handleAdminStartCampaign),
// filled in alongside campaign creation -- bypasses the self-serve
// pending_payment -> pending_review -> active lifecycle entirely since
// there's no payment to confirm here; inserted already 'active'. No
// account_id (migrations/0017_ads_account_optional.sql) -- a directly-
// booked sponsor has no self-serve advertiser account to attach to.
export async function createSponsorAd(env, { campaignId, imageKey, imageContentType, linkUrl, amountKobo, reviewedBy }) {
  const id = crypto.randomUUID();
  const startsAt = Math.floor(Date.now() / 1000);
  const endsAt = startsAt + CAMPAIGN_BANNER_FALLBACK_DAYS * 86400;
  await env.DB.prepare(
    `INSERT INTO ads (id, account_id, slot, campaign_id, image_key, image_content_type, link_url, package, amount_kobo, status, starts_at, ends_at, reviewed_by, reviewed_at)
     VALUES (?, NULL, 'campaign_banner', ?, ?, ?, ?, 'campaign', ?, 'active', ?, ?, ?, unixepoch())`
  ).bind(id, campaignId, imageKey, imageContentType, linkUrl, amountKobo, startsAt, endsAt, reviewedBy || null).run();
  return id;
}

export async function getAdById(env, id) {
  return env.DB.prepare(`SELECT * FROM ads WHERE id = ?`).bind(id).first();
}

export async function markAdPendingReview(env, id, paystackReference) {
  await env.DB.prepare(
    `UPDATE ads SET status = 'pending_review', paystack_reference = ?, updated_at = unixepoch()
     WHERE id = ? AND status = 'pending_payment'`
  ).bind(paystackReference, id).run();
}

export async function getPendingReviewAds(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ads WHERE status = 'pending_review' ORDER BY created_at ASC`
  ).all();
  return results;
}

// Duration is computed from the ad's own `package` at approval time (not
// payment time) -- see migrations/0005_ads.sql's comment for why.
export async function approveAd(env, id, reviewedBy) {
  const ad = await getAdById(env, id);
  if (!ad) return null;
  const durationDays = ad.slot === 'campaign_banner' ? CAMPAIGN_BANNER_FALLBACK_DAYS : (AD_DURATION_DAYS[ad.package] || 1);
  const startsAt = Math.floor(Date.now() / 1000);
  const endsAt = startsAt + durationDays * 86400;
  await env.DB.prepare(
    `UPDATE ads SET status = 'active', starts_at = ?, ends_at = ?, reviewed_by = ?, reviewed_at = unixepoch(), updated_at = unixepoch()
     WHERE id = ?`
  ).bind(startsAt, endsAt, reviewedBy, id).run();
  return { startsAt, endsAt };
}

export async function rejectAd(env, id, reviewedBy, reason) {
  await env.DB.prepare(
    `UPDATE ads SET status = 'rejected', reviewed_by = ?, reviewed_at = unixepoch(), rejection_reason = ?, updated_at = unixepoch()
     WHERE id = ?`
  ).bind(reviewedBy, reason || null, id).run();
}

// Active, unexpired ads for ONE slot -- src/index.js picks one per slot via
// its own independent time-bucket rotation, so each position on the page
// rotates separately rather than all sharing one global pick.
// campaign_banner is special-cased: it additionally requires the ad's own
// linked campaign to still be the CURRENTLY active one, so a sponsor's ad
// stops showing the moment that campaign ends even if its own ends_at
// (a generous fallback bound, see CAMPAIGN_BANNER_FALLBACK_DAYS) hasn't
// been reached yet -- otherwise a new campaign could start and inherit the
// previous sponsor's banner by accident.
export async function getActiveAdsForSlot(env, slot) {
  const now = Math.floor(Date.now() / 1000);
  if (slot === 'campaign_banner') {
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.image_key, a.image_content_type, a.link_url FROM ads a
       JOIN campaigns c ON c.id = a.campaign_id
       WHERE a.slot = 'campaign_banner' AND a.status = 'active'
         AND a.starts_at <= ? AND a.ends_at > ? AND c.status = 'active'
       ORDER BY a.created_at ASC`
    ).bind(now, now).all();
    return results;
  }
  const { results } = await env.DB.prepare(
    `SELECT id, image_key, image_content_type, link_url FROM ads
     WHERE slot = ? AND status = 'active' AND starts_at <= ? AND ends_at > ?
     ORDER BY created_at ASC`
  ).bind(slot, now, now).all();
  return results;
}

// Capacity check at purchase time -- counts 'active' (currently showing)
// and 'pending_review' (paid, awaiting approval -- will likely become
// active soon, so it reserves a spot) against the slot's cap.
// 'pending_payment' doesn't count: an abandoned, never-paid-for ad
// shouldn't occupy inventory.
//
// campaignId: required scoping for the campaign_banner slot specifically
// -- a sponsor's ad.status stays 'active' for a 90-day fallback window
// (see CAMPAIGN_BANNER_FALLBACK_DAYS) even after its own campaign has
// long ended, since nothing ever flips it back; without this filter, one
// campaign selling out its 4 slots would leave EVERY future campaign
// showing "fully booked" for up to 90 days, despite none of those old
// banners still being displayed (getActiveAdsForSlot already correctly
// excludes them by campaign). Left null for every other slot, which
// isn't campaign-scoped at all and keeps counting exactly as before.
export async function countAdsInSlot(env, slot, campaignId = null) {
  const campaignClause = campaignId ? 'AND campaign_id = ?' : '';
  const binds = campaignId ? [slot, campaignId] : [slot];
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ads WHERE slot = ? ${campaignClause} AND status IN ('active', 'pending_review')`
  ).bind(...binds).first();
  return row?.n ?? 0;
}

// Revenue -- counts anything that got PAST pending_payment (i.e. a real
// Paystack charge was confirmed via markAdPendingReview), regardless of
// what happened after. 'rejected' still counts: this system has no
// refund flow, so a rejected ad's payment was still actually collected.
// 'pending_payment' itself never counts -- an abandoned, never-paid-for
// ad isn't revenue.
export async function getAdRevenueBySlot(env) {
  const { results } = await env.DB.prepare(
    `SELECT slot, COUNT(*) AS n, SUM(amount_kobo) AS total_kobo FROM ads
     WHERE status IN ('pending_review', 'active', 'rejected') GROUP BY slot`
  ).all();
  return results;
}

// -- Social unlock (paid perk, see migrations/0013_social_unlock_per_day_pricing.sql) --

export async function createPendingSocialUnlock(env, { id, accountId, days, amountKobo }) {
  await env.DB.prepare(
    `INSERT INTO social_unlocks (id, account_id, days, amount_kobo) VALUES (?, ?, ?, ?)`
  ).bind(id, accountId, days, amountKobo).run();
}

export async function getSocialUnlockById(env, id) {
  return env.DB.prepare(`SELECT * FROM social_unlocks WHERE id = ?`).bind(id).first();
}

// Backs the admin Ads page's revenue section -- only 'paid' rows count
// (unlike getAdRevenueBySlot, a social unlock has no "rejected but
// still paid" status to include; pending_payment rows never collected).
export async function getSocialUnlockRevenue(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(amount_kobo) AS total_kobo FROM social_unlocks WHERE status = 'paid'`
  ).first();
  return { n: row?.n || 0, totalKobo: row?.total_kobo || 0 };
}

// Extends (not replaces) whatever time is already left on the account's
// unlock, same as stacking more time onto an active subscription --
// buying 7 more days while 3 are still running leaves 10, not 7.
// Returns null if this purchase was already applied (idempotent, same
// "only act if still pending_payment" guard used for ads, so a redirect-
// confirm racing the webhook for the same purchase is a harmless no-op
// the second time).
export async function markSocialUnlockPaid(env, id, paystackReference) {
  const unlock = await getSocialUnlockById(env, id);
  if (!unlock || unlock.status !== 'pending_payment') return null;
  const now = Math.floor(Date.now() / 1000);
  const account = await env.DB.prepare(`SELECT social_unlock_ends_at FROM accounts WHERE id = ?`).bind(unlock.account_id).first();
  const base = account?.social_unlock_ends_at && account.social_unlock_ends_at > now ? account.social_unlock_ends_at : now;
  const endsAt = base + unlock.days * 86400;
  await env.DB.prepare(
    `UPDATE social_unlocks SET status = 'paid', paystack_reference = ? WHERE id = ?`
  ).bind(paystackReference, id).run();
  await env.DB.prepare(
    `UPDATE accounts SET social_unlock_ends_at = ? WHERE id = ?`
  ).bind(endsAt, unlock.account_id).run();
  return { endsAt };
}

// -- Announcements ---------------------------------------------------------

export async function createAnnouncement(env, { title, body, createdBy }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO announcements (id, title, body, created_by) VALUES (?, ?, ?, ?)`
  ).bind(id, title, body, createdBy || null).run();
  return env.DB.prepare(`SELECT * FROM announcements WHERE id = ?`).bind(id).first();
}

export async function getAnnouncements(env, limit = 100) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM announcements ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return results;
}

export async function deleteAnnouncement(env, id) {
  await env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
}

// -- Admin users / RBAC (migrations/0015_admin_users.sql) ------------------

export async function countAdminUsers(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users`).first();
  return row?.n || 0;
}

export async function getAdminUserByEmail(env, email) {
  return env.DB.prepare(`SELECT * FROM admin_users WHERE email = ?`).bind(email.toLowerCase()).first();
}

export async function getAdminUserById(env, id) {
  return env.DB.prepare(`SELECT * FROM admin_users WHERE id = ?`).bind(id).first();
}

export async function createAdminUser(env, { email, passwordHash, passwordSalt, displayName, role, createdBy }) {
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO admin_users (id, email, password_hash, password_salt, display_name, role, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, email.toLowerCase(), passwordHash, passwordSalt, displayName, role, createdBy || null).run();
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) return null;
    throw error;
  }
  return env.DB.prepare(`SELECT * FROM admin_users WHERE id = ?`).bind(id).first();
}

// Newest first, every account regardless of role/disabled state -- backs
// the superadmin-only "Admins" management page's full list.
export async function listAdminUsers(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, email, display_name, role, disabled_at, created_at FROM admin_users ORDER BY created_at DESC`
  ).all();
  return results;
}

export async function setAdminUserDisabled(env, id, disabled) {
  await env.DB.prepare(
    `UPDATE admin_users SET disabled_at = ? WHERE id = ?`
  ).bind(disabled ? Math.floor(Date.now() / 1000) : null, id).run();
}

export async function setAdminUserRole(env, id, role) {
  await env.DB.prepare(`UPDATE admin_users SET role = ? WHERE id = ?`).bind(role, id).run();
}

// Hard delete -- clears what references this row first (admin_sessions.
// admin_user_id and admin_users.created_by both have a plain REFERENCES
// with no ON DELETE clause, so SQLite would otherwise block this on the
// foreign key) before removing the account itself.
export async function deleteAdminUser(env, id) {
  await env.DB.prepare(`DELETE FROM admin_sessions WHERE admin_user_id = ?`).bind(id).run();
  await env.DB.prepare(`UPDATE admin_users SET created_by = NULL WHERE created_by = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id).run();
}

export async function setAdminUserPassword(env, id, passwordHash, passwordSalt) {
  await env.DB.prepare(
    `UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?`
  ).bind(passwordHash, passwordSalt, id).run();
}

// Called right after a password reset -- any session created under the
// old password should not keep working, including on whatever device is
// currently signed in with it.
export async function deleteAdminSessionsForUser(env, adminUserId) {
  await env.DB.prepare(`DELETE FROM admin_sessions WHERE admin_user_id = ?`).bind(adminUserId).run();
}

// Active (non-disabled) superadmins only -- used to block disabling the
// last one, which would otherwise permanently lock everyone out of
// account management (no other bootstrap path once /admin/setup retires
// itself after the first account exists).
export async function countActiveSuperadmins(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM admin_users WHERE role = 'superadmin' AND disabled_at IS NULL`
  ).first();
  return row?.n || 0;
}

export async function createAdminSession(env, token, adminUserId, ttlSeconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await env.DB.prepare(
    `INSERT INTO admin_sessions (token, admin_user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(token, adminUserId, expiresAt).run();
}

export async function deleteAdminSession(env, token) {
  await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(token).run();
}

// Same "lazily-expired row is just treated as absent" convention as
// getAccountBySessionToken -- also excludes a disabled admin immediately,
// even with an otherwise still-valid session token.
export async function getAdminUserBySessionToken(env, token) {
  return env.DB.prepare(
    `SELECT au.* FROM admin_sessions s
     JOIN admin_users au ON au.id = s.admin_user_id
     WHERE s.token = ? AND s.expires_at > unixepoch() AND au.disabled_at IS NULL`
  ).bind(token).first();
}
