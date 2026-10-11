// Live + all-time visitor counting, as a single global Durable Object
// instance (src/index.js always calls env.PRESENCE_DO.idFromName('global')
// -- one object, not sharded). A DO is the right tool for this
// specifically because every ping is a tiny read/write against shared
// state, from potentially tens of thousands of open tabs at once -- a DO
// serves that out of memory/its own embedded SQLite with no network hop
// to a separate database, where D1 would mean a real round trip per ping
// and a shared connection pool under real contention.
//
// Uses the SQLite-backed Durable Object storage API (`ctx.storage.sql`,
// enabled via wrangler.toml's `new_sqlite_classes` migration) rather than
// the older key-value DO storage -- lets this reuse a real SQL table/query
// shape (same idea as the D1 version this replaced) instead of hand-rolling
// counters over raw key-value puts.
//
// Durability note: `first_seen`/`last_seen` persist in the DO's own
// SQLite storage, so the all-time total survives the DO being evicted
// from memory during a quiet period (Cloudflare does this after a period
// of inactivity) -- the next request just reopens the same storage.
const LIVE_WINDOW_SECONDS = 45;

export class PresenceCounter {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS presence (
        visitor_id TEXT PRIMARY KEY,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      )`
    );
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence (last_seen)`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (url.pathname === '/ping' && request.method === 'POST') {
      const { visitorId } = await request.json();
      if (!visitorId || typeof visitorId !== 'string') {
        return new Response('Bad request', { status: 400 });
      }
      this.sql.exec(
        `INSERT INTO presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?)
         ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen`,
        visitorId, nowSeconds, nowSeconds
      );
      return Response.json({ success: true });
    }

    if (url.pathname === '/stats' && request.method === 'GET') {
      const cutoff = nowSeconds - LIVE_WINDOW_SECONDS;
      const live = [...this.sql.exec(`SELECT COUNT(*) AS n FROM presence WHERE last_seen > ?`, cutoff)][0]?.n ?? 0;
      const total = [...this.sql.exec(`SELECT COUNT(*) AS n FROM presence`)][0]?.n ?? 0;
      return Response.json({ live, total });
    }

    // Backs the admin Campaigns page's "Views" stat -- distinct visitors
    // active at any point during [start, end] (their [first_seen,
    // last_seen] window overlaps the query window), not just visitors
    // first-ever-seen in that range -- a returning visitor who was active
    // during this campaign still counts, even if Cloudflare first saw
    // them earlier. Only ever asked for a DIFFERENT campaign's distinct
    // (non-overlapping) window, since at most one campaign runs at a
    // time -- a visitor's row can only ever match one campaign's query
    // this way, never double-count across two.
    if (url.pathname === '/stats-range' && request.method === 'GET') {
      const start = Number(url.searchParams.get('start')) || 0;
      const end = Number(url.searchParams.get('end')) || nowSeconds;
      const views = [...this.sql.exec(
        `SELECT COUNT(*) AS n FROM presence WHERE first_seen <= ? AND last_seen >= ?`,
        end, start
      )][0]?.n ?? 0;
      return Response.json({ views });
    }

    return new Response('Not found', { status: 404 });
  }
}
