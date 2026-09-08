import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

// Same pattern as /api/config/verification -- a pure feature flag, gated
// on whether the bot is actually configured in this environment, so the
// Settings tab is never shown before TELEGRAM_BOT_TOKEN/WEBHOOK_SECRET
// are set (e.g. before the bot exists yet in local dev).
export async function GET(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const enabled = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
  return NextResponse.json({ success: true, enabled });
}
