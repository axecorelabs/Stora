import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { redis, withTimeout, telegramLinkKey, telegramLinkLimiter } from '@/lib/redis';

const CODE_TTL_SECONDS = 600; // 10 minutes -- long enough to switch to the Telegram app, short enough that a stale code isn't a standing risk.

// POST -- generates a one-time linking code and returns the deep link the
// Settings tab renders as a button. Same opaque-token-with-expiry shape
// already used for campaign attribution (crypto.randomBytes + a TTL'd
// store), not a signed/self-contained token -- there's no reason to avoid
// the DB/cache round trip here, and this codebase has no JWT/HMAC-token
// issuance pattern to match instead.
export async function POST(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_BOT_USERNAME) {
    return NextResponse.json({ success: false, message: 'Telegram is not configured' }, { status: 400 });
  }

  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .single();

  if (!store) {
    return NextResponse.json({ success: false, message: 'Store not found' }, { status: 404 });
  }

  const { success: withinLimit } = await telegramLinkLimiter.limit(store.id);
  if (!withinLimit) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Try again later.' },
      { status: 429 }
    );
  }

  const code = crypto.randomBytes(16).toString('hex');

  try {
    await withTimeout(redis.set(telegramLinkKey(code), store.id, { ex: CODE_TTL_SECONDS }));
  } catch (error) {
    console.error('Failed to store Telegram linking code:', error.message);
    return NextResponse.json({ success: false, message: 'Failed to start linking. Try again.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`,
    expiresInSeconds: CODE_TTL_SECONDS
  });
}
