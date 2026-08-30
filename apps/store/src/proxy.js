import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, withTimeout } from '@/lib/redis';
import { isValidNigerianState } from '@stora/shared-constants';

// Falls back to a literal default rather than throwing when unset -- this
// only matters once vendor subdomains are actually wired up in DNS/Vercel;
// until then every request's host is the apex anyway and the rewrite below
// is a no-op.
const APEX_DOMAIN = process.env.NEXT_PUBLIC_STORE_APEX_DOMAIN || 'stora.com.ng';

// Same DNS-label shape check workers/subdomain-router's Cloudflare Worker
// uses -- kept independent (not imported from anywhere shared) since a
// request can reach this proxy directly against the Vercel deployment too,
// without going through that Worker at all (local dev, or the origin
// domain hit directly). This is the second, and only truly load-bearing,
// line of defense: it decides what actually gets rewritten to a store's
// [slug] routes, not just a sanity check.
const VALID_SUBDOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const DELIVER_STATE_COOKIE = 'stora_deliver_state';
// Marks a state cookie written from a bare IP guess, not a URL param or
// anything DeliveryStateContext.js itself confirmed -- see its own
// GUESS_COOKIE_NAME comment for why that distinction has to survive past
// this write (a guess must never outrank the customer's real saved
// preference once that resolves client-side).
const DELIVER_STATE_GUESS_COOKIE = 'stora_deliver_state_is_guess';
const DELIVER_STATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, mirrors DeliveryStateContext.js's own cookie

// Standard ISO 3166-2:NG subdivision codes -- Vercel's x-vercel-ip-country-region
// header returns exactly this (the region half, country stripped), e.g. "LA"
// for Lagos. Best-effort only: geo-IP accuracy for Nigerian ranges is
// spotty (VPNs, mobile carrier NAT), which is exactly why this is only ever
// a quiet fallback below a URL param or an already-set cookie, never
// authoritative, and an unrecognized code is simply ignored rather than
// guessed at.
const NG_REGION_CODE_TO_STATE = {
  AB: 'Abia', AD: 'Adamawa', AK: 'Akwa Ibom', AN: 'Anambra', BA: 'Bauchi', BY: 'Bayelsa',
  BE: 'Benue', BO: 'Borno', CR: 'Cross River', DE: 'Delta', EB: 'Ebonyi', ED: 'Edo',
  EK: 'Ekiti', EN: 'Enugu', FC: 'FCT', GO: 'Gombe', IM: 'Imo', JI: 'Jigawa', KD: 'Kaduna',
  KN: 'Kano', KT: 'Katsina', KE: 'Kebbi', KO: 'Kogi', KW: 'Kwara', LA: 'Lagos',
  NA: 'Nasarawa', NI: 'Niger', OG: 'Ogun', ON: 'Ondo', OS: 'Osun', OY: 'Oyo',
  PL: 'Plateau', RI: 'Rivers', SO: 'Sokoto', TA: 'Taraba', YO: 'Yobe', ZA: 'Zamfara'
};

// Resolves what (if anything) the "deliver to" cookie should become for
// this request -- a URL param always wins outright (explicit marketing-
// link intent overrides whatever's already set, guess or not), otherwise
// a guess from Vercel's geo headers fills in only when no cookie exists
// yet at all, so it never clobbers a real manual choice or a previously-
// adopted profile value. Returns null when nothing should change.
function resolveDeliverStateCookie(req) {
  const urlState = req.nextUrl.searchParams.get('deliverTo');
  if (urlState && isValidNigerianState(urlState)) return { value: urlState, isGuess: false };

  if (req.cookies.get(DELIVER_STATE_COOKIE)?.value) return null;

  const country = req.headers.get('x-vercel-ip-country');
  const region = req.headers.get('x-vercel-ip-country-region');
  if (country === 'NG' && region && NG_REGION_CODE_TO_STATE[region]) {
    return { value: NG_REGION_CODE_TO_STATE[region], isGuess: true };
  }

  return null;
}

// Sliding-window per-route limiters, keyed by client IP. Each is a
// standalone Ratelimit instance (Upstash's recommended pattern) so
// different routes don't share a budget. Despite the name, also covers
// the exact-path payment/checkout routes below -- same "explicit map
// keyed by exact pathname" mechanism as the auth routes, just not auth
// itself.
const authLimiters = {
  '/api/auth/customer/login': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'store:rl:login' }),
  '/api/auth/customer/register': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'store:rl:register' }),
  '/api/auth/customer/forgot-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'store:rl:forgot-password' }),
  '/api/auth/customer/reset-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'store:rl:reset-password' }),
  '/api/auth/customer/verify-email': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'store:rl:verify-email' }),
  '/api/auth/customer/resend-verification': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'store:rl:resend-verification' }),
  '/api/auth/google/start': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'store:rl:google-start' }),
  '/api/auth/google/callback': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'store:rl:google-callback' }),
  '/api/payments/initiate': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'store:rl:payments-initiate' }),
  '/api/payments/verify': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, '5 m'), prefix: 'store:rl:payments-verify' }),
  // Paystack's own servers call the webhook (retries on non-2xx), and
  // Vercel Cron calls the cleanup job -- neither is a real end user, both
  // just need a generous bound so they're never starved by browseLimiter.
  '/api/payments/webhook': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'store:rl:payments-webhook' }),
  '/api/payments/cleanup-abandoned': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'store:rl:payments-cleanup' }),
  // Neither of these was covered by the matcher at all until now -- both
  // were completely unlimited. Sized like the payment routes above rather
  // than the generous browse bucket below: placing an order is a rare,
  // meaningful-per-session action (payments/initiate-level sensitivity),
  // and even genuine rapid shopping rarely adds more than a handful of
  // items to cart in five minutes.
  '/api/orders/create': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'store:rl:orders-create' }),
  '/api/cart/add': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '5 m'), prefix: 'store:rl:cart-add' }),
  // Tighter than plain browsing on purpose -- each request has a real
  // OpenRouter cost behind it on a cache miss, unlike free keyword search.
  '/api/search/ai': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'store:rl:search-ai' }),
};

// Real navigations, genuine API calls, AND Next.js's own silent <Link>
// prefetching (which fires for every link in the viewport, well before a
// visitor clicks anything -- the homepage alone renders up to 10 vendor
// cards (VendorShowcase.js) + 12 product cards (DiscoverySection.js),
// each a real <Link>, so just loading and scrolling it can fire 20+ of
// these before any click). A token bucket rather than the previous flat
// sliding window, since this traffic is naturally bursty (a page mount's
// own requests plus a batch of prefetches all land together) rather than
// a smooth rate; this absorbs that burst while still bounding sustained
// abuse to the steady refill rate.
//
// Deliberately ONE bucket, not a separate prefetch-only one: Next.js sets
// a `Next-Router-Prefetch` header on these requests, but reading it from
// inside middleware is a confirmed, longstanding Next.js bug (the header
// never actually appears on `req.headers` there --
// https://github.com/vercel/next.js/issues/63728), so there is no
// reliable way to identify a prefetch here and give it its own budget.
// Excluding prefetches from this middleware entirely via the matcher's
// `missing` condition was considered and rejected -- that check runs in
// Next's own routing layer before invoking this function, so it isn't
// affected by the same bug, but it would exempt any request carrying that
// one header from rate limiting altogether, and the header itself is just
// a client-settable string with nothing to stop a scraper from adding it
// to bypass the limiter entirely. Sizing this single bucket generously
// enough to comfortably absorb a full page's worth of prefetches plus
// real browsing sidesteps the whole problem without depending on a
// broken platform feature or opening that hole. 3/s refill (180/min
// steady) with a 150-token bucket (comfortably above one homepage load's
// ~26 total requests, with headroom for several more pages after).
const browseLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(3, '1 s', 150),
  prefix: 'store:rl:browse'
});

function getClientIp(req) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

// workers/subdomain-router's Cloudflare Worker forwards <slug>.stora.com.ng
// requests to this app's own apex domain, preserving the real subdomain in
// X-Forwarded-Host (see that Worker's comments for why the Host header
// itself can't carry it -- Vercel routes by Host, so left alone it would
// resolve to no project at all). A request reaching this app directly --
// local dev, or the apex domain itself -- has no such header, so `host` is
// exactly right for those instead.
//
// Returns { rewriteUrl } when the request is for a real vendor subdomain,
// { notFound: true } for a malformed/unrecognized one that still matched
// the apex suffix, or null when there's nothing to do (apex/www, or a host
// that isn't under this domain at all -- a raw *.vercel.app request, a
// misconfigured DNS entry -- left to resolve exactly as it would with no
// rewrite at all).
function resolveVendorSubdomainRewrite(req) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostname = (forwardedHost || req.headers.get('host') || '').split(':')[0].toLowerCase();

  const apexSuffix = `.${APEX_DOMAIN}`;
  const isApex = hostname === APEX_DOMAIN || hostname === `www.${APEX_DOMAIN}`;
  if (isApex || !hostname.endsWith(apexSuffix)) return null;

  const slug = hostname.slice(0, -apexSuffix.length);
  if (slug.includes('.') || !VALID_SUBDOMAIN_LABEL.test(slug)) return { notFound: true };

  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = `/${slug}${req.nextUrl.pathname}`;
  return { rewriteUrl };
}

export async function proxy(req) {
  const path = req.nextUrl.pathname;

  // Page paths only -- API routes already carry whatever slug/id they
  // need directly in their own path (e.g. /api/store/[slug]), so rewriting
  // would only break them (prefixing a path they don't expect). Note this
  // never runs at all for /cart, /wishlist, /orders or /reset-password --
  // the matcher below excludes those from the page catch-all, so a vendor
  // subdomain visiting one of those four falls back to the generic,
  // unbranded page rather than the [slug]-prefixed one. Both render the
  // same account-level data either way (cart contents aren't per-vendor),
  // so this is a narrow, accepted cosmetic gap, not a functional break --
  // widening that exclusion would also change this file's rate-limit/
  // cookie behavior for those four paths, which isn't worth risking for it.
  //
  // A 404 short-circuits immediately below (nothing to rate-limit or set
  // a delivery cookie for on a dead end), but a real vendor subdomain
  // rewrite still flows through both -- rate limiting is IP-keyed, not
  // path-keyed, for page loads, and the delivery-state cookie is just as
  // relevant browsing a vendor's own subdomain as it is on the apex.
  let rewriteUrl = null;
  if (!path.startsWith('/api/')) {
    const subdomainResult = resolveVendorSubdomainRewrite(req);
    if (subdomainResult?.notFound) {
      return new NextResponse('Not found', { status: 404 });
    }
    rewriteUrl = subdomainResult?.rewriteUrl || null;
  }

  const limiter = authLimiters[path] || browseLimiter;

  try {
    const ip = getClientIp(req);
    const { success, limit, remaining, reset } = await withTimeout(limiter.limit(ip));

    if (!success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
          },
        }
      );
    }
  } catch (error) {
    // Fail open: a Redis outage must never block a legitimate request.
    console.error('Rate limit check failed, allowing request:', error);
  }

  const response = rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next();

  const resolved = resolveDeliverStateCookie(req);
  if (resolved) {
    response.cookies.set(DELIVER_STATE_COOKIE, resolved.value, {
      path: '/',
      maxAge: DELIVER_STATE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    if (resolved.isGuess) {
      response.cookies.set(DELIVER_STATE_GUESS_COOKIE, '1', {
        path: '/',
        maxAge: DELIVER_STATE_COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
    } else {
      // A URL param is a real, confirmed value -- clear any stale guess
      // flag so DeliveryStateContext.js's rule 2 doesn't later treat it
      // as one it should still override once the real profile resolves.
      response.cookies.set(DELIVER_STATE_GUESS_COOKIE, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/api/auth/customer/:path*',
    '/api/auth/google/:path*',
    '/api/payments/:path*',
    '/api/store/:path*',
    '/api/stores/:path*',
    '/api/products/:path*',
    '/api/search/:path*',
    '/api/orders/:path*',
    '/api/cart/:path*',
    '/((?!api|_next/static|_next/image|favicon\\.ico|cart|wishlist|orders|reset-password).*)',
  ],
};
