import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

// TEMPORARY -- self-registers this deployment's Telegram webhook on first
// dashboard load, standing in for the one-time `setWebhook` curl command
// documented in .env.example (no shell/CLI access to this deployment to
// run it directly). Safe to call repeatedly: checks getWebhookInfo first
// and skips the actual setWebhook call if it's already correct. Delete
// this route and its call site in DashboardLayout.js once the webhook is
// confirmed registered (Settings > Connect Telegram completes correctly).
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
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await infoRes.json();
    if (info.ok && info.result?.url === webhookUrl) {
      return NextResponse.json({ success: true, alreadyRegistered: true });
    }

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

    return NextResponse.json({ success: true, alreadyRegistered: false });
  } catch (error) {
    console.error('Telegram webhook self-registration failed:', error.message);
    return NextResponse.json({ success: false, message: 'Request to Telegram failed' }, { status: 502 });
  }
}
