import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, withTimeout } from '@/lib/redis';

// Sliding-window per-route limiters, keyed by client IP. Each is a
// standalone Ratelimit instance (Upstash's recommended pattern) so
// different routes don't share a budget.
const authLimiters = {
  '/api/auth/customer/login': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'store:rl:login' }),
  '/api/auth/customer/register': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'store:rl:register' }),
  '/api/auth/customer/forgot-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'store:rl:forgot-password' }),
  '/api/auth/customer/reset-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'store:rl:reset-password' }),
  '/api/auth/customer/verify-email': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'store:rl:verify-email' }),
  '/api/auth/customer/resend-verification': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'store:rl:resend-verification' }),
  '/api/auth/google/start': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'store:rl:google-start' }),
  '/api/auth/google/callback': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'store:rl:google-callback' }),
};

// Generous catch-all for everything else matched below (public storefront
// pages + public browsing API) -- scraper/enumeration deterrent, not meant
// to bother a real shopper.
const browseLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'store:rl:browse' });

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
    '/api/store/:path*',
    '/api/stores/:path*',
    '/api/products/:path*',
    '/((?!api|_next/static|_next/image|favicon\\.ico|cart|wishlist|orders|reset-password).*)',
  ],
};
