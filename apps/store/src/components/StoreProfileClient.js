"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Mail, ExternalLink } from "lucide-react";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import Reveal from "@/components/ui/Reveal";
import ListingGallery from "@/components/ListingGallery";
import useStoreStore from "@/stores/storeStore";
import { storeHref } from "@/lib/storeUrl";
import { deriveStoreTheme } from "@/lib/storeTheme";

// This page used to be a bare <main>, no StoreHeader/StoreFooter at all --
// a shopper clicking "Gallery & Location" from the storefront nav landed
// somewhere that looked like a completely different, unstyled site. Same
// shell every other browsing page (ProductsPageClient.js) already uses:
// hydrate the Zustand store so StoreHeader/StoreFooter render this
// vendor's real branding, not the empty default.
export default function StoreProfileClient({ store, gallery, addressText, mapUrl, embedUrl, contacts }) {
  const router = useRouter();
  const { setStore } = useStoreStore();

  useEffect(() => {
    if (store) setStore(store);
  }, [store, setStore]);

  const theme = deriveStoreTheme(store.branding?.primaryColor);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.canvas }}>
      <StoreHeader store={store} />

      <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8 sm:py-10">
        <button
          onClick={() => router.push(storeHref(store.storeSlug))}
          className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ color: theme.accent }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to storefront
        </button>

        <Reveal
          as="header"
          className="mt-5 rounded-md border p-5 sm:p-7"
          style={{ borderColor: theme.border, backgroundColor: theme.tintFaint }}
        >
          <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase mb-1.5" style={{ color: theme.accent }}>
            Business profile
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl" style={{ color: theme.ink }}>
            {store.storeName}
          </h1>
          {store.storeDescription && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed sm:text-base" style={{ color: `${theme.ink}CC` }}>
              {store.storeDescription}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {contacts.phone && (
              <a
                href={`tel:${contacts.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:brightness-95 transition-all"
                style={{ borderColor: theme.border, color: theme.ink }}
              >
                <Phone className="h-3.5 w-3.5" style={{ color: theme.accent }} />
                Call
              </a>
            )}
            {contacts.email && (
              <a
                href={`mailto:${contacts.email}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:brightness-95 transition-all"
                style={{ borderColor: theme.border, color: theme.ink }}
              >
                <Mail className="h-3.5 w-3.5" style={{ color: theme.accent }} />
                Email
              </a>
            )}
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:brightness-95 transition-all"
                style={{ borderColor: theme.border, color: theme.ink }}
              >
                <MapPin className="h-3.5 w-3.5" style={{ color: theme.accent }} />
                Open map
              </a>
            )}
          </div>
        </Reveal>

        <Reveal
          as="section"
          className="mt-8 rounded-md border bg-white p-5 sm:p-7"
          style={{ borderColor: theme.border }}
        >
          {gallery.length > 0 ? (
            <ListingGallery items={gallery} />
          ) : (
            <>
              <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase mb-1.5" style={{ color: theme.accent }}>Look inside</p>
              <h2 className="font-display text-lg font-semibold mb-2" style={{ color: theme.ink }}>Gallery</h2>
              <p className="text-sm text-gray-500">No gallery images have been published yet.</p>
            </>
          )}
        </Reveal>

        <Reveal
          as="section"
          className="mt-6 rounded-md border bg-white p-5 pb-0 sm:p-7"
          style={{ borderColor: theme.border }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase mb-1" style={{ color: theme.accent }}>Visit in person</p>
              <h2 className="font-display text-lg font-semibold" style={{ color: theme.ink }}>Location</h2>
            </div>
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold hover:brightness-95"
                style={{ borderColor: theme.border, color: theme.accent }}
              >
                Open in Maps
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {addressText && embedUrl ? (
            <>
              <p className="mb-3 text-sm text-gray-600">{addressText}</p>
              <div className="-mx-5 h-64 overflow-hidden border-y border-gray-200 bg-gray-100 sm:mx-0 sm:h-72 sm:rounded-md sm:border">
                <iframe
                  title="Store location"
                  src={embedUrl}
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </>
          ) : (
            <p className="pb-5 text-sm text-gray-500 sm:pb-7">Location details are not available yet.</p>
          )}
        </Reveal>
      </div>

      <StoreFooter />
    </div>
  );
}
