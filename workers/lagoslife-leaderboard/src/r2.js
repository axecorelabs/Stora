// Object storage for both balance-proof screenshots AND account avatars.
// Uses the native R2 binding (env.SCREENSHOTS_BUCKET), not the
// S3-compatible API apps/dashboard/src/lib/r2.js uses -- that file is on
// Vercel/Next.js, which has no native binding access; a real Worker
// always should. No credentials, no AWS SDK.
//
// The bucket is kept PRIVATE (no public access / custom domain). The two
// kinds of object stored in it have different exposure, both enforced in
// src/index.js, not here: screenshots (key prefix "submissions/") are
// only ever read back through the Basic-Auth-gated GET /admin/screenshot/:id
// route; avatars (key prefix "avatars/") are meant to be publicly visible
// on the leaderboard, so GET /avatar/:accountId streams them with no auth
// at all -- the bucket itself stays private either way, this Worker is
// just the only thing that can read it.

// The browser-reported Content-Type on a multipart file part is trivially
// spoofable -- this sniffs the actual leading bytes instead of trusting
// that claim. Ported as-is from apps/dashboard/src/lib/r2.js's
// detectImageMimeType (same three signatures, dependency-free).
export function detectImageMimeType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

const EXT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export function extForContentType(contentType) {
  return EXT_BY_CONTENT_TYPE[contentType] || 'bin';
}

// No sharp/resize/recompress here -- unsupported in the Workers V8-isolate
// sandbox (no native-binary support, even with nodejs_compat). Both
// screenshots and avatars are stored exactly as uploaded; src/index.js
// caps the incoming size via Content-Length before this is ever called.
export async function putObject(env, key, bytes, contentType) {
  await env.SCREENSHOTS_BUCKET.put(key, bytes, {
    httpMetadata: { contentType }
  });
}

export async function getObject(env, key) {
  return env.SCREENSHOTS_BUCKET.get(key);
}
