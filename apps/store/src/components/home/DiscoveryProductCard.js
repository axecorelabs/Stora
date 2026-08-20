"use client";
import { useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";

// Deliberately lighter than store/ProductCard.js -- that card's job is
// browsing and transacting inside one already-chosen vendor's storefront
// (wishlist, add-to-cart, stock badges). This card's only job is discovery:
// entice, then hand the visitor off to the real storefront where the full
// experience already works correctly. It also can't reuse ProductCard.js
// as-is: that component derives the store slug from the current URL path,
// which is meaningless on a cross-vendor page -- this one takes it
// explicitly from the product's own store record instead.
export default function DiscoveryProductCard({ product }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [logoErrored, setLogoErrored] = useState(false);
  const accentColor = product.store?.primaryColor || "#145C41";
  const storeSlug = product.store?.storeSlug;
  const storeInitial = (product.store?.storeName || "?").trim().charAt(0).toUpperCase();
  const showLogoImage = product.store?.logo && !logoErrored;

  const formatPrice = (price) => `₦${Number(price || 0).toLocaleString("en-NG")}`;

  const card = (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-[0_4px_16px_rgba(11,59,46,0.08)] hover:-translate-y-0.5 transition-all duration-200 group h-full">
      <div className="p-3">
        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden"
          style={{ backgroundColor: product.store?.secondaryColor || "#F3F4F6" }}
        >
          {product.image ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-100 animate-pulse" />
              )}
              <img
                src={product.image}
                alt={product.productName}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3.5">
        {product.store?.storeName && (
          <p className="text-[11px] text-gray-400 truncate mb-1">
            {product.store.storeName}
            {product.store.state && <> · {product.store.state}</>}
          </p>
        )}
        <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5 line-clamp-1">
          {product.productName}
        </h3>
        <div className="flex items-end justify-between gap-2">
          <p className="text-base font-bold tabular-nums" style={{ color: accentColor }}>
            {formatPrice(product.sellingPrice)}
          </p>

          {/* Which vendor this is, at a glance, without repeating the full
              name a second time -- same logo-or-initial fallback as
              VendorCard.js, so a store with no uploaded logo still gets a
              recognizable, consistent mark. */}
          {product.store && (
            <div
              className="w-6 h-6 rounded-full border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: showLogoImage ? "#fff" : accentColor }}
              title={product.store.storeName}
            >
              {showLogoImage ? (
                <img
                  src={product.store.logo}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setLogoErrored(true)}
                />
              ) : (
                <span className="font-display text-[10px] font-bold text-white leading-none">
                  {storeInitial}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!storeSlug) return card;

  return (
    // ?from=discover -- ProductDetailsClient reads this to know the visitor
    // arrived from general Stora browsing, not this vendor's own storefront,
    // so its back/continue-shopping actions return here instead of the
    // vendor's storefront (which would strand a cross-vendor browsing
    // session). No param at all (e.g. a direct link, or store/ProductCard.js
    // within the storefront itself) is the correct default for "this really
    // is a vendor-storefront visit."
    <Link href={`/${storeSlug}/product/${product.id}?from=discover`} className="block h-full">
      {card}
    </Link>
  );
}
