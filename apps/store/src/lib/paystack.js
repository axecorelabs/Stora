import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function paystackFetch(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok || data.status === false) {
    const error = new Error(data.message || `Paystack request failed: ${response.status}`);
    error.paystackResponse = data;
    throw error;
  }

  return data;
}

async function paystackRequest(path, options) {
  const data = await paystackFetch(path, options);
  return data.data;
}

// POST /transaction/initialize -- amount is in kobo, computed server-side
// from the order's own stored total (never trust a client-supplied
// amount). split is Paystack's inline dynamic split object -- built
// fresh per checkout since the ratio differs every time, not a
// pre-created Split resource. See apps/store/src/app/api/payments/initiate/route.js.
export function initializeTransaction({ email, amountKobo, reference, split, metadata, callbackUrl }) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: amountKobo,
      reference,
      split,
      metadata,
      callback_url: callbackUrl
    }
  });
}

// GET /transaction/verify/:reference -- the authoritative server-to-server
// check. Both the webhook path and the client verify-on-return path call
// this same function; neither trusts the webhook payload or the client
// popup callback alone.
export function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Verifies the x-paystack-signature header: HMAC-SHA512 of the raw
// request body using the secret key, timing-safe compare. Must be called
// with the RAW body string (before any JSON.parse) -- the signature is
// computed over the exact bytes Paystack sent.
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// GET /settlement -- settlements Paystack has actually paid out (or
// attempted to), used by the settlement-sync cron. `subaccount` narrows
// this to one vendor's settlements when passed, but the cron never trusts
// that filter alone -- it always confirms membership via
// listSettlementTransactions below, so this stays correct even if the
// filter is ever ignored or behaves differently than documented.
export function listSettlements({ from, to, subaccount, page = 1, perPage = 50 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (subaccount) params.set('subaccount', subaccount);
  return paystackFetch(`/settlement?${params.toString()}`);
}

// GET /settlement/:id/transactions -- the actual transactions bundled into
// one settlement. This, not the settlement record itself, is what proves a
// specific charge was paid out -- a settlement batches many transactions
// together, so listSettlements alone can't say which order it covers.
export function listSettlementTransactions(settlementId, { page = 1, perPage = 100 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return paystackFetch(`/settlement/${encodeURIComponent(settlementId)}/transactions?${params.toString()}`);
}
