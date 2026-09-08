import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

// TEMPORARY -- self-registers this deployment's Telegram webhook on first
// dashboard load, standing in for the one-time `setWebhook` curl command
// documented in .env.example (no shell/CLI access to this deployment to
// run it directly). Delete this route and its call site in
// DashboardLayout.js once the webhook is confirmed registered (Settings >
// Connect Telegram completes correctly).
export async function POST(req) {
  const user = await verifySession(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return NextResponse.json({ success: false, message: 'Telegram is not configured' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ success: false, message: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 400 });
  }
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  try {
    // Read the PRIOR state first, purely for diagnostics -- Telegram
    // tracks delivery failures here (last_error_message/date,
    // pending_update_count), which is the closest thing to a production
    // log we have access to from this deployment.
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await infoRes.json();
    const prior = info.ok ? info.result : null;

    // Always (re-)call setWebhook, even if the URL already matches --
    // Telegram never echoes secret_token back via getWebhookInfo, so a
    // URL-only match can't rule out a stale/mismatched secret left over
    // from an earlier manual registration. Idempotent on Telegram's side
    // either way, so there's no cost to always re-asserting it.
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret })
    });
    const setData = await setRes.json();
    if (!setRes.ok || !setData.ok) {
      console.error('Telegram setWebhook failed:', setData.description || setRes.status);
      return NextResponse.json(
        { success: false, message: setData.description || 'setWebhook failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      webhookUrl,
      priorUrlMatched: prior?.url === webhookUrl,
      priorLastErrorMessage: prior?.last_error_message || null,
      priorLastErrorDate: prior?.last_error_date || null,
      priorPendingUpdateCount: prior?.pending_update_count ?? null
    });
  } catch (error) {
    console.error('Telegram webhook self-registration failed:', error.message);
    return NextResponse.json({ success: false, message: 'Request to Telegram failed' }, { status: 502 });
  }
}
