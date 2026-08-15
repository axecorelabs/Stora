import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, withTimeout } from '@/lib/redis';

// Sliding-window per-route limiters, keyed by client IP. Each is a
// standalone Ratelimit instance (Upstash's recommended pattern) so
// different routes don't share a budget.
const limiters = {
  '/api/auth/signin': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'dashboard:rl:signin' }),
  '/api/auth/signup': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'dashboard:rl:signup' }),
  '/api/auth/forgot-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'dashboard:rl:forgot-password' }),
  '/api/auth/reset-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'dashboard:rl:reset-password' }),
  '/api/auth/verify-email': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'dashboard:rl:verify-email' }),
  '/api/auth/resend-verification': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'dashboard:rl:resend-verification' }),
  '/api/auth/change-password': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'dashboard:rl:change-password' }),
  '/api/auth/google/start': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'dashboard:rl:google-start' }),
  '/api/auth/google/callback': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'dashboard:rl:google-callback' }),
};

function getClientIp(req) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

export async function proxy(req) {
  const path = req.nextUrl.pathname;
  const limiter = limiters[path];

  if (!limiter) {
    return NextResponse.next();
  }

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
  matcher: ['/api/auth/:path*'],
};
