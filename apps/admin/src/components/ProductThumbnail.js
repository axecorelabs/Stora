"use client";
import { Package } from "lucide-react";

// Product-row thumbnail -- mirrors StoreLogo's shape (image or icon
// fallback) but square/rounded-lg rather than circular, matching how
// apps/dashboard itself distinguishes store logos from product images.
export default function ProductThumbnail({ imageUrl, size = 36 }) {
  const dimension = `${size}px`;
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="rounded-lg object-cover shrink-0 bg-gray-100"
        style={{ width: dimension, height: dimension }}
      />
    );
  }
  return (
    <span
      className="rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"
      style={{ width: dimension, height: dimension }}
    >
      <Package className="w-4 h-4" />
    </span>
  );
}
