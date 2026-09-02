"use client";
import { Store } from "lucide-react";

// Circular vendor avatar -- branding.logo is a plain image URL (see
// apps/dashboard's stores/branding route), falls back to a plain icon
// when a vendor hasn't uploaded one.
export default function StoreLogo({ logoUrl, size = 32 }) {
  const dimension = `${size}px`;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="rounded-full object-cover shrink-0 bg-gray-100"
        style={{ width: dimension, height: dimension }}
      />
    );
  }
  return (
    <span
      className="rounded-full bg-brand-100 text-brand-800 flex items-center justify-center shrink-0"
      style={{ width: dimension, height: dimension }}
    >
      <Store className="w-4 h-4" />
    </span>
  );
}
