import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Ported from apps/dashboard/src/lib/r2.js -- kept as its own copy rather
// than a shared package (no precedent for one in this monorepo; see
// legalAcceptance.js's own "two copies, not shared" note), since R2 was
// dashboard-only infrastructure until the AI Try-On feature needed it
// here too. Same bucket/credentials as the dashboard for now (MVP), keyed
// under its own `tryon/`/`tryon-results/` prefixes -- separating into its
// own bucket (cleaner lifecycle-policy hygiene for the 24-48h auto-delete
// requirement) is a later hardening step, not required to ship Phase 1.
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

export async function uploadToR2(file, key, contentTypeOverride) {
  try {
    let buffer;
    if (file instanceof Buffer) {
      buffer = file;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentTypeOverride || file.type || 'application/octet-stream',
      Metadata: {
        'upload-timestamp': Date.now().toString()
      }
    }));

    return `${PUBLIC_URL_BASE}/${key}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload image');
  }
}

export async function generatePresignedUploadUrl(key, contentType, expiresIn = 300) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream'
    });
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

export async function deleteFromR2(key) {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    return true;
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw new Error('Failed to delete image');
  }
}

export function extractKeyFromUrl(url) {
  try {
    const { pathname } = new URL(url);
    let path = pathname.replace(/^\/+/, '');
    if (BUCKET_NAME && path.startsWith(`${BUCKET_NAME}/`)) {
      path = path.slice(BUCKET_NAME.length + 1);
    }
    return path || null;
  } catch (error) {
    console.error('Error extracting key from URL:', url, error);
    return null;
  }
}

export function getPublicUrlForKey(key) {
  if (!PUBLIC_URL_BASE || !key) return null;
  return `${PUBLIC_URL_BASE}/${String(key).replace(/^\/+/, '')}`;
}

export async function generatePresignedUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}

// The browser-reported Content-Type on a presigned PUT is just a header
// the uploader chose -- trivially spoofable, same as the multipart-form
// case dashboard's own r2.js guards against with this exact check. R2's
// HeadObject (getObjectMetadata below) only ever reports that claimed
// type back, never the real bytes, so a claim-only check at finalize time
// would accept literally any file as long as it's PUT with an
// image/* Content-Type header. This sniffs the real leading bytes instead.
function detectImageMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// Range-reads just enough of the object to sniff its real format --
// avoids downloading the full multi-MB file just to check its first
// dozen bytes. 16 bytes covers every signature detectImageMimeType checks
// (WebP's RIFF....WEBP marker is the longest, ending at byte 12).
export async function detectRealImageType(key, byteCount = 16) {
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: `bytes=0-${byteCount - 1}`
    }));
    const buffer = Buffer.from(await result.Body.transformToByteArray());
    return detectImageMimeType(buffer);
  } catch (error) {
    console.error('Error range-reading object from R2:', error);
    return null;
  }
}

export async function getObjectMetadata(key) {
  try {
    const result = await s3.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    return {
      contentType: result.ContentType || null,
      contentLength: Number(result.ContentLength || 0),
      etag: result.ETag || null,
      lastModified: result.LastModified || null
    };
  } catch (error) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error('Error reading object metadata from R2:', error);
    throw new Error('Failed to verify uploaded object');
  }
}
