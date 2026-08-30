"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";

// High error-correction ('H', ~30% recoverable) rather than the default --
// this is meant to end up printed small on packaging, a flyer, or a shop
// window sticker, where a scuff or a low-quality print is more likely than
// on a screen.
const QR_OPTIONS_BASE = { width: 512, margin: 2, errorCorrectionLevel: "H" };

// Keyed by websiteUrl+primaryColor in the parent below so a change to
// either fully remounts this instead of needing to reset state from
// inside an effect (see StoreQrCode's own comment on why).
function QrCodePanel({ websiteUrl, primaryColor, storeSlug, storeName }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(websiteUrl, {
      ...QR_OPTIONS_BASE,
      color: { dark: primaryColor, light: "#FFFFFFFF" }
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate store QR code:", err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [websiteUrl, primaryColor]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${storeSlug || "store"}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        Couldn&apos;t generate a QR code right now. Try refreshing the page.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-3 rounded-xl border border-gray-100 bg-white">
        {dataUrl ? (
          // A generated data: URI, not a remote image -- next/image's
          // optimizer has nothing to do here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code linking to ${storeName || "the"} store website`}
            className="w-40 h-40 lg:w-48 lg:h-48"
          />
        ) : (
          <div className="w-40 h-40 lg:w-48 lg:h-48 bg-gray-100 rounded-lg animate-pulse" />
        )}
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs">
        Scans straight to your store. Print it on packaging, receipts, or a
        window sticker so customers can shop in one tap.
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

export default function StoreQrCode({ store }) {
  const websiteUrl = store?.websiteUrl;
  const primaryColor = store?.branding?.primaryColor || "#0B3B2E";

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
      <SectionHeader icon={QrCode} title="Store QR Code" />

      {!websiteUrl ? (
        <div className="text-center py-6">
          <QrCode className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">No website URL yet</p>
          <p className="text-xs text-gray-400">
            Set up your website to get a scannable QR code for your store
          </p>
        </div>
      ) : (
        <QrCodePanel
          key={`${websiteUrl}|${primaryColor}`}
          websiteUrl={websiteUrl}
          primaryColor={primaryColor}
          storeSlug={store?.storeSlug}
          storeName={store?.storeName}
        />
      )}
    </div>
  );
}
