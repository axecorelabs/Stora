"use client";

// Ported from apps/dashboard/src/lib/imageCompression.js -- same need
// here (a phone camera selfie routinely lands at 3-8MB, well past the
// try-on upload route's 5MB cap), just a different target size matching
// this app's own presigned-upload limit rather than the dashboard's
// server-proxied one.
const MAX_DIMENSION = 2000; // px, longest side
const TARGET_BYTES = 5 * 1024 * 1024; // matches /api/tryon/upload-url's cap
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

export async function compressImageIfNeeded(file, targetBytes = TARGET_BYTES) {
  if (!file || !file.type?.startsWith("image/") || file.size <= targetBytes) {
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

    while (canAdjustQuality && blob.size > targetBytes && quality > MIN_QUALITY) {
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
