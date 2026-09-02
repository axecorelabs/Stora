import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// Trimmed copy of apps/dashboard/src/lib/r2.js -- this app only ever
// uploads one thing (a campaign banner), so no presigned-URL/delete
// helpers needed here. Same Cloudflare R2 bucket/credentials as
// apps/dashboard (see apps/admin/.env.local's own comment on why these
// are copied rather than a second bucket provisioned).
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

export async function uploadToR2(buffer, key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: { 'upload-timestamp': Date.now().toString() }
  }));
  return `${PUBLIC_URL_BASE}/${key}`;
}

export function generateFileKey(prefix) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${prefix}/${timestamp}-${randomString}.webp`;
}

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

// A campaign banner is wider than a product/logo photo (16:9 hero use,
// not a square thumbnail), so this caps the long edge higher than
// apps/dashboard's own 1600px product-photo limit.
const MAX_BANNER_DIMENSION = 1920;
const WEBP_QUALITY = 80;

export async function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 4 * 1024 * 1024; // 4MB -- a wide banner photo runs larger than a square product shot

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 4MB');
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  if (!detectImageMimeType(rawBuffer)) {
    throw new Error('This file does not appear to be a valid JPEG, PNG, or WebP image');
  }

  const buffer = await sharp(rawBuffer)
    .resize({ width: MAX_BANNER_DIMENSION, height: MAX_BANNER_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer, contentType: 'image/webp' };
}
