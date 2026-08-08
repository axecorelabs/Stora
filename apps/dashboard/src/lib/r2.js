import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

// Upload file to R2
export async function uploadToR2(file, key) {
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
      ContentType: file.type || 'application/octet-stream',
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

// Generate a unique file key
export function generateFileKey(userId, originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop().toLowerCase();
  return `inventory/${userId}/${timestamp}-${randomString}.${extension}`;
}

// Validate image file
export function validateImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  if (file.size > maxSize) {
    throw new Error('Image size must be less than 5MB');
  }

  return true;
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
