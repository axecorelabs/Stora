import crypto from 'crypto';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// Telegram's own webhook-auth scheme: the secret_token passed to
// setWebhook is echoed back on every update as this header -- a static
// equality check, not HMAC (there's no payload signing here, unlike
// Paystack's x-paystack-signature), but still timing-safe for the same
// reason apps/store/src/lib/paystack.js's verifyWebhookSignature is:
// nothing about comparing a secret should leak via response-time.
export function verifyWebhookSecret(headerValue) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !headerValue) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(headerValue, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Plain fetch, no SDK -- same style as qoreid.js's own qoreidRequest.
// Used here only for the bot's own in-chat replies (webhook handler
// confirming a link or rejecting an expired code); the actual per-order
// notification send is apps/store/src/lib/telegram.js's own copy of this,
// since that's a different app and this file can't be imported across
// the Next.js app boundary.
export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(`Telegram sendMessage failed: ${data.description || response.status}`);
    error.telegramStatus = response.status;
    error.telegramErrorCode = data.error_code;
    throw error;
  }

  return data.result;
}
