"use client";

// Client-side resize/re-encode so a large source photo (phone camera
// JPEGs routinely land at 3-8MB) still comes in under the 2MB upload
// limit (lib/r2.js's validateImageFile) without the person ever seeing a
// rejection. Vercel's ~4.5MB serverless request-body cap is a hard
// platform constraint (see r2.js's own comment on why 2MB, not 5MB) --
// raising the app's own limit can't work around that, so this shrinks
// what's actually sent instead of asking people to pre-shrink it
// themselves.
const MAX_DIMENSION = 2000; // px, longest side -- generous for a banner/logo/product photo
const TARGET_BYTES = 2 * 1024 * 1024; // matches lib/r2.js's validateImageFile
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.15;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))),
      type,
      quality
    );
  });
}

// Returns a File already under the target size where possible, same name
// and MIME type as the original -- a PNG stays a PNG (so a logo's
// transparency survives; re-encoding it is lossless, so only the
// dimension shrink helps there), while JPEG/WebP additionally step down
// through quality passes since those formats actually support it. Falls
// back to returning the original file untouched on anything unexpected
// (can't decode it, output came out no smaller) -- the caller's own
// size/type validation is still the real gate either way, this is purely
// a best-effort head start so most people never hit it.
export async function compressImageIfNeeded(file) {
  if (!file || !file.type?.startsWith("image/") || file.size <= TARGET_BYTES) {
    return file;
  }

  let img, url;
  try {
    ({ img, url } = await loadImage(file));
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const canAdjustQuality = file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/webp";
    let quality = 0.85;
    let blob = await canvasToBlob(canvas, file.type, canAdjustQuality ? quality : undefined);

    while (canAdjustQuality && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= QUALITY_STEP;
      blob = await canvasToBlob(canvas, file.type, quality);
    }

    if (blob.size >= file.size) return file;

    return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
