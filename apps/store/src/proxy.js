import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, withTimeout } from '@/lib/redis';

// Sliding-window per-route limiters, keyed by client IP. Each is a
// standalone Ratelimit instance (Upstash's recommended pattern) so
// different routes don't share a budget. Despite the name, also covers
// the exact-path payment routes below -- same "explicit map keyed by
// exact pathname" mechanism as the auth routes, just not auth itself.
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

export async function proxy(req) {
  const path = req.nextUrl.pathname;
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

  return NextResponse.next();
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
    '/((?!api|_next/static|_next/image|favicon\\.ico|cart|wishlist|orders|reset-password).*)',
  ],
};
