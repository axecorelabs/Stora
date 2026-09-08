import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { redis, withTimeout, telegramLinkKey } from '@/lib/redis';
import { verifyWebhookSecret, sendTelegramMessage } from '@/lib/telegram';

// Telegram calls this directly -- no vendor session exists here, so the
// X-Telegram-Bot-Api-Secret-Token header (set via setWebhook's
// secret_token param when the bot was registered) is the only trust
// boundary, same role Paystack's x-paystack-signature plays on the store
// app's payment webhook.
export async function POST(request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!verifyWebhookSecret(secret)) {
    console.error('Telegram webhook secret mismatch (possible spoofed request)');
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  try {
    const message = update.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;

    // Only /start (with or without a code) is handled -- this bot has no
    // other commands yet, it's a one-shot linking handshake plus a
    // passive notification channel afterward.
    if (text?.startsWith('/start') && chatId) {
      const code = text.split(' ')[1]?.trim();

      if (!code) {
        await sendTelegramMessage(
          chatId,
          "Hi! Open this from the “Connect Telegram” button in your Stora dashboard's Settings page to link your store."
        );
        return NextResponse.json({ success: true });
      }

      let storeId;
      try {
        storeId = await withTimeout(redis.get(telegramLinkKey(code)));
      } catch (error) {
        console.error('Telegram link code lookup failed:', error.message);
      }

      if (!storeId) {
        await sendTelegramMessage(
          chatId,
          'This link has expired. Go back to your Stora dashboard’s Settings page and tap “Connect Telegram” again.'
        );
        return NextResponse.json({ success: true });
      }

      // Redeemed immediately -- single-use, so a stale/replayed /start
      // with the same code can never re-link (or hijack) a second chat.
      try {
        await withTimeout(redis.del(telegramLinkKey(code)));
      } catch (error) {
        console.warn('Telegram link code cleanup failed (non-fatal):', error.message);
      }

      const username = message.from?.username || message.from?.first_name || null;
      const { error: updateError } = await supabaseAdmin
        .from('stores')
        .update({ telegram_chat_id: chatId, telegram_username: username, updated_at: new Date().toISOString() })
        .eq('id', storeId);

      if (updateError) {
        console.error('Error linking Telegram chat to store:', updateError);
        await sendTelegramMessage(chatId, 'Something went wrong linking your account. Please try again from your dashboard.');
        return NextResponse.json({ success: true });
      }

      await sendTelegramMessage(chatId, '✅ Connected! You’ll get new order notifications here from now on.');
    }
  } catch (error) {
    // Never surface as a non-2xx -- there's nothing about retrying an
    // update Telegram would do differently, same reasoning the Paystack
    // webhook always returns 200 after a downstream processing error.
    console.error('Error processing Telegram webhook update:', error);
  }

  return NextResponse.json({ success: true });
}
