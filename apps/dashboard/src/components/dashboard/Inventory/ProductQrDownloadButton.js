"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { generateQrDataUrl } from "@/lib/generateQrDataUrl";

// The table's row-actions panel doesn't need to show the QR image itself
// (unlike the full item details page's ProductQrCode) -- generating it
// lazily, only when actually clicked, avoids running QRCode.toDataURL for
// every expanded row up front for no reason.
export default function ProductQrDownloadButton({ url, color, filename, className }) {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!url) return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const dataUrl = await generateQrDataUrl(url, color);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to generate product QR code:", err);
      alert("Could not generate the QR code right now. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {isGenerating ? 'Generating…' : 'Download QR'}
    </button>
  );
}
