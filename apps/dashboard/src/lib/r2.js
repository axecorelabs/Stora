import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

// Cloudflare R2 — S3-compatible API, but no per-object ACLs. Public access comes
// from a custom domain (or the r2.dev subdomain) connected to the bucket, not
// from an ACL on the object, so uploads never set one.
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  // AWS SDK v3's newer default (streaming SHA-256 checksum trailers) isn't
  // handled the same way by R2 and fails PutObject with
  // XAmzContentSHA256Mismatch -- only compute checksums when the API actually
  // requires them.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
// Base URL the bucket is publicly reachable at (custom domain or r2.dev), no trailing slash.
const PUBLIC_URL_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// Upload file to R2. `contentTypeOverride` -- pass the value validateImageFile
// already verified against the actual file bytes, rather than falling back
// to file.type (the browser-reported Content-Type, which a raw multipart
// request can set to anything regardless of the real file contents).
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

// Delete file from R2
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

// Recover the object key from a previously-stored public URL. Works for both
// path-style URLs (bucket name in the path, e.g. old Wasabi links) and a
// custom/r2.dev domain mapped straight to the bucket root, and doesn't assume
// anything about where ".com" appears in the host.
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

// Generate a unique file key. Always .webp -- every upload now passes
// through compressImage() below on its way out of validateImageFile, so
// whatever format the file arrived in (JPEG/PNG/WebP), what actually gets
// stored is always WebP. Keying it by the ORIGINAL upload's extension
// would leave a mismatch between the URL's apparent format and its real
// content (harmless to browsers, which trust the Content-Type header, but
// confusing to anyone reading a "photo.jpg" URL that's actually WebP).
export function generateFileKey(userId) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `inventory/${userId}/${timestamp}-${randomString}.webp`;
}

// The browser-reported file.type checked below is trivially spoofable in a
// raw multipart request (it's just a Content-Type string the uploader
// chose) -- this sniffs the actual leading bytes of each allowed format
// instead of trusting that claim. No library for this that a repo-wide
// check turned up, and only three signatures are needed, so a small
// dependency-free check beats pulling one in.
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

// Product/branding photos land here straight from phone cameras -- often
// several MB at 3000px+ wide, far larger than any context they're ever
// displayed at (a homepage measurement found images alone accounted for
// 11.5MB of an 11.6MB page load). Capping the long edge at 1600px covers
// every current display size, including a 2x-retina render of a
// moderate-width hero image, without keeping resolution nobody asked for.
// `fit: 'inside'` preserves aspect ratio; `withoutEnlargement` means a
// already-small image is never upscaled. WebP at quality 80 is the
// standard "visually near-lossless, meaningfully smaller than JPEG/PNG"
// tradeoff, and (unlike PNG) still supports the transparency a logo
// upload needs -- one output format covers every input type this
// validator accepts.
const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 80;

async function compressImage(buffer) {
  return sharp(buffer)
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

// Validate image file. Returns { buffer, contentType } on success -- buffer
// is the RESIZED/RECOMPRESSED WebP output (not the raw upload) so callers
// never need to touch the original bytes again, and contentType is always
// 'image/webp' now, reflecting what's actually about to be stored rather
// than the client's (unverified, and now also stale) format claim.
export async function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  // Vercel's Node.js serverless functions hard-cap the request BODY at
  // ~4.5MB, enforced at the platform edge before the function even runs --
  // a file (or, for a route that accepts two at once like branding's
  // logo+banner, two files together) anywhere near the old 5MB-per-file
  // limit blew straight through that cap. The connection just gets reset,
  // which surfaces client-side as a bare "Failed to fetch" with no HTTP
  // response to show a real error for -- this validation never even runs
  // in that case, since the request never reaches it. 2MB per file keeps
  // any single request (including two files together) comfortably under
  // the platform limit, with room for multipart overhead. This is a limit
  // on the INCOMING upload only -- what's actually stored after
  // compressImage() runs is typically far smaller than this cap.
  const maxSize = 2 * 1024 * 1024; // 2MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  if (file.size > maxSize) {
    throw new Error('Image size must be less than 2MB');
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  if (!detectImageMimeType(rawBuffer)) {
    throw new Error('This file does not appear to be a valid JPEG, PNG, or WebP image');
  }

  const buffer = await compressImage(rawBuffer);
  return { buffer, contentType: 'image/webp' };
}

// Generate presigned URL for private access (if needed)
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
