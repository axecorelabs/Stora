import crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 10 * 60;

function base64UrlEncode(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecodeToString(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSigningSecret() {
  const secret = process.env.GALLERY_UPLOAD_INTENT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing GALLERY_UPLOAD_INTENT_SECRET (or JWT_SECRET fallback)');
  }
  return secret;
}

export function createGalleryUploadIntent(payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;

  const intentPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + safeTtl,
    jti: crypto.randomUUID(),
    v: 1,
  };

  const header = { alg: 'HS256', typ: 'GALLERY_UPLOAD_INTENT' };
  const headerPart = base64UrlEncode(header);
  const payloadPart = base64UrlEncode(intentPayload);
  const body = `${headerPart}.${payloadPart}`;

  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url');

  return `${body}.${signature}`;
}

export function verifyGalleryUploadIntent(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Upload intent token is required');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid upload intent token');
  }

  const [headerPart, payloadPart, providedSignature] = parts;
  const body = `${headerPart}.${payloadPart}`;

  const expectedSignature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url');

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new Error('Invalid upload intent signature');
  }

  const header = JSON.parse(base64UrlDecodeToString(headerPart));
  if (header?.alg !== 'HS256') {
    throw new Error('Unsupported upload intent algorithm');
  }

  const payload = JSON.parse(base64UrlDecodeToString(payloadPart));
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!payload?.exp || nowSeconds >= payload.exp) {
    throw new Error('Upload intent expired');
  }

  return payload;
}
