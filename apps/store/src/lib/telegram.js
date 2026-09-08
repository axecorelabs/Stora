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
//
// Built as an array of blocks joined by a blank line, rather than one
// hand-spaced template string -- keeps every section (header, items,
// total, customer) visually separated and consistent regardless of which
// optional pieces (customer name, location) are actually present, instead
// of ad hoc \n vs \n\n calls drifting out of sync as fields get added.
export async function sendTelegramOrderNotification(chatId, { orderNumber, items, total, customerName, city, state }) {
  const header = `🛎 <b>New order received</b>\nOrder <b>${escapeHtml(orderNumber)}</b>`;

  const itemLines = (items || [])
    .map(item => `${item.quantity}× ${escapeHtml(item.product_name)} — ₦${Number(item.subtotal).toLocaleString('en-NG')}`)
    .join('\n');
  const itemsBlock = itemLines ? `🧾 <b>Items</b>\n${itemLines}` : null;

  const totalBlock = `💰 <b>Total: ₦${Number(total).toLocaleString('en-NG')}</b>`;

  // City is free text the customer typed, state is picked from a fixed
  // list (see isValidNigerianState) -- escaped together regardless, same
  // as customerName below, since neither is safe to trust as-is in HTML
  // parse_mode.
  const location = [city, state].filter(Boolean).join(', ');
  const customerBlock = [
    customerName ? `👤 ${escapeHtml(customerName)}` : null,
    location ? `📍 ${escapeHtml(location)}` : null
  ].filter(Boolean).join('\n') || null;

  const footer = 'Open your dashboard to view and manage this order.';

  const text = [header, itemsBlock, totalBlock, customerBlock, footer].filter(Boolean).join('\n\n');

  await sendTelegramMessage(chatId, text);
}

export { sendTelegramMessage };
