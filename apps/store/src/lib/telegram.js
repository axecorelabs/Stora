const TELEGRAM_API_BASE = 'https://api.telegram.org';

// Send-only -- this app never receives Telegram webhooks (the bot's
// linking handshake and in-chat replies live entirely in apps/dashboard's
// own lib/telegram.js). Same plain-fetch style as that file and as
// apps/dashboard/src/lib/qoreid.js -- no SDK, one small wrapper.
async function sendTelegramMessage(chatId, text) {
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
    error.telegramErrorCode = data.error_code;
    throw error;
  }

  return data.result;
}

// HTML parse_mode, not Markdown -- Telegram's Markdown mode requires
// escaping a long list of special characters in any user-supplied text
// (a customer's name, an order note), and getting that escaping wrong
// silently breaks the whole message; HTML only requires escaping
// &, <, > which is one small helper instead of a fragile allowlist.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Called from sendStoreOrderNotifications (orderNotifications.js) as a
// third best-effort channel alongside the existing in-app notification
// and email -- same order data already resolved there, no extra fetching
// needed. Returns the caller's own decision of what to do on failure
// (specifically: self-heal on a 403, meaning the vendor blocked the bot --
// see the call site).
export async function sendTelegramOrderNotification(chatId, { orderNumber, itemCount, total, customerName }) {
  const text =
    `🛎 <b>New order received</b>\n\n` +
    `Order <b>${escapeHtml(orderNumber)}</b>\n` +
    `${itemCount} item${itemCount === 1 ? '' : 's'} · ₦${Number(total).toLocaleString('en-NG')}\n` +
    (customerName ? `From ${escapeHtml(customerName)}\n` : '') +
    `\nOpen your dashboard to view and manage this order.`;

  await sendTelegramMessage(chatId, text);
}

export { sendTelegramMessage };
