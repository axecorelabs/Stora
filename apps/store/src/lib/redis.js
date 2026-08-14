import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

// Both apps share one physical Redis database -- every key must be
// namespaced per app to avoid collisions.
export const NS = 'store';

export const sessionKey = (sessionId) => `${NS}:session:${sessionId}`;
export const failedKey = (email) => `${NS}:failed:${email}`;
export const lockoutKey = (email) => `${NS}:lockout:${email}`;

// Bounds worst-case latency so a hung (not just erroring) Redis call can
// never stall a request -- pairs with try/catch fail-open everywhere.
export async function withTimeout(promise, ms = 750) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), ms))
  ]);
}
