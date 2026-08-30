import QRCode from "qrcode";

// Shared by ProductQrCode.js (eager, shown on the item details page) and
// ProductQrDownloadButton.js (lazy, generated on click from the inventory
// table's row actions) -- same options StoreQrCode.js uses for the store's
// own website QR, so a vendor's product and storefront codes look and
// behave consistently. High error-correction ('H', ~30% recoverable)
// since these end up printed small on packaging, a flyer, or a shop
// window sticker.
export function generateQrDataUrl(url, color) {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: color, light: "#FFFFFFFF" }
  });
}
