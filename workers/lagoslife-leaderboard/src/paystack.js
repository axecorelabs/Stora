// Mirrors apps/dashboard's existing Paystack conventions exactly (same
// base URL, auth header, request/response envelope) -- confirmed by
// reading apps/dashboard/src/lib/paystack.js and its subscription routes,
// not guessed. Two deliberate differences from that code, both upgrades:
// 1. verifyTransaction's caller checks the paid amount against the
//    expected amount (apps/dashboard's confirm route never does this).
// 2. Signature verification uses the Web Crypto API (crypto.subtle),
//    not Node's `crypto` module -- this Worker has no nodejs_compat flag
//    and no Node APIs available.
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function paystackRequest(env, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack error: ${res.status}`);
  }
  return data.data;
}

export async function initializeTransaction(env, { email, amountKobo, callbackUrl, metadata }) {
  return paystackRequest(env, '/transaction/initialize', {
    method: 'POST',
    body: { email, amount: amountKobo, callback_url: callbackUrl, metadata }
  });
}

export async function verifyTransaction(env, reference) {
  return paystackRequest(env, `/transaction/verify/${encodeURIComponent(reference)}`);
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// HMAC-SHA512 of the raw, unparsed request body -- same scheme
// apps/dashboard's webhook uses, compared against the x-paystack-signature
// header. Must run against the exact bytes Paystack signed, before any
// JSON.parse of the body.
export async function verifyWebhookSignature(env, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(signature), signatureHeader);
}
