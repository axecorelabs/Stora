"use client";
import { useEffect, useState } from "react";
import { QrCode, Download } from "lucide-react";
import Button from "@/components/ui/Button";
import { generateQrDataUrl } from "@/lib/generateQrDataUrl";

// Keyed by url+color in the default export below so a change to either
// fully remounts this instead of needing to reset state from inside an
// effect (same reasoning apps/dashboard's StoreQrCode.js documents for
// its own identical pattern).
function QrPanel({ url, color, filename }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    generateQrDataUrl(url, color)
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch((err) => {
        console.error("Failed to generate product QR code:", err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url, color]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        Couldn&apos;t generate a QR code right now. Try refreshing the page.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 rounded-xl border border-gray-100 bg-white">
        {dataUrl ? (
          // A generated data: URI, not a remote image -- next/image's
          // optimizer has nothing to do here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="QR code linking to this product's storefront page"
            className="w-36 h-36"
          />
        ) : (
          <div className="w-36 h-36 bg-gray-100 rounded-lg animate-pulse" />
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Scans straight to this product&apos;s page. Great for a shelf tag or
        a printed flyer.
      </p>

      <Button
        variant="secondary"
        size="sm"
        onClick={handleDownload}
        disabled={!dataUrl}
        className="w-full justify-center"
      >
        <Download className="w-4 h-4" />
        <span>Download QR Code</span>
      </Button>
    </div>
  );
}

export default function ProductQrCode({ url, color, filename }) {
  if (!url) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <QrCode className="w-5 h-5 text-brand-800" />
        Product QR Code
      </h3>
      <QrPanel key={`${url}|${color}`} url={url} color={color} filename={filename} />
    </div>
  );
}
