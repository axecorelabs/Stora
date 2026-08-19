import { redis, withTimeout } from './redis';

const QOREID_BASE_URL = process.env.QOREID_BASE_URL || 'https://api.qoreid.com';
const TOKEN_CACHE_KEY = 'dashboard:qoreid:token';
// QoreID tokens last 7200s -- cached with a margin so a request never
// straddles the actual expiry.
const TOKEN_CACHE_TTL_SECONDS = 7000;

// OAuth2 client-credentials exchange, cached in Redis (shared across
// serverless invocations) rather than in-memory, which wouldn't
// reliably persist between cold starts. A cache miss/error just means
// one extra token request, not a broken flow -- same fail-open shape as
// the rest of this file's Redis usage.
async function getAccessToken() {
  try {
    const cached = await withTimeout(redis.get(TOKEN_CACHE_KEY));
    if (cached) return cached;
  } catch (error) {
    console.warn('QoreID token cache read failed, requesting fresh:', error.message);
  }

  const response = await fetch(`${QOREID_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.QOREID_CLIENT_ID,
      secret: process.env.QOREID_CLIENT_SECRET
    })
  });

  const data = await response.json();
  if (!response.ok || !data.accessToken) {
    throw new Error('Failed to obtain QoreID access token');
  }

  try {
    await withTimeout(redis.set(TOKEN_CACHE_KEY, data.accessToken, { ex: TOKEN_CACHE_TTL_SECONDS }));
  } catch (error) {
    console.warn('QoreID token cache write failed, continuing without cache:', error.message);
  }

  return data.accessToken;
}

async function qoreidRequest(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${QOREID_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    // Never attach the raw response to the thrown error's message (it can
    // carry PII, e.g. bio-data on a failed match) -- callers get a plain
    // failure and log only a generic reason, per this feature's "no raw
    // identifiers in logs" rule.
    const error = new Error(`QoreID request failed: ${response.status}`);
    error.qoreidStatus = response.status;
    throw error;
  }

  return data;
}

// POST /v1/ng/identities/nin/{idNumber} -- idNumber is a PATH param here.
// firstname/lastname are sent to be matched against the record QoreID
// holds; the response's own bio-data is the source of truth for the
// actual match comparison done by the caller, not just a boolean.
export function verifyNIN({ idNumber, firstname, lastname }) {
  return qoreidRequest(`/v1/ng/identities/nin/${encodeURIComponent(idNumber)}`, {
    method: 'POST',
    body: { firstname, lastname }
  });
}

// POST /v1/ng/identities/face-verification/nin -- idNumber is in the
// BODY here, not the path -- a different shape from verifyNIN above,
// confirmed directly against QoreID's reference docs rather than assumed
// to match. photoBase64 is used only for this single request; nothing in
// this file (or its callers) ever persists it.
export function verifyNINFaceMatch({ idNumber, photoBase64 }) {
  return qoreidRequest('/v1/ng/identities/face-verification/nin', {
    method: 'POST',
    body: { idNumber, photoBase64 }
  });
}
