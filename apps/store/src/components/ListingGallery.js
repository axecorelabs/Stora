"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Grid2X2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ListingGallery({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const touchStartX = useRef(null);
  const total = items?.length || 0;
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const showPrevious = useCallback(() => {
    setActiveIndex((current) => (current === null || total === 0 ? current : (current - 1 + total) % total));
  }, [total]);
  const showNext = useCallback(() => {
    setActiveIndex((current) => (current === null || total === 0 ? current : (current + 1) % total));
  }, [total]);
  const close = useCallback(() => setActiveIndex(null), []);

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(delta) < 45) return;
    if (delta > 0) showPrevious();
    else showNext();
  };

  useEffect(() => {
    if (activeIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, close, showNext, showPrevious]);

  if (!items?.length) return null;

  return (
    <section id="gallery" className="pt-6 sm:pt-10">
      <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
        <h2 className="text-[18px] font-bold leading-none tracking-normal text-black sm:text-3xl">Gallery</h2>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="text-[11px] leading-none sm:text-base">{total} photos</span>
          <Grid2X2 className="h-4 w-4 stroke-brand-900 stroke-[2.7] sm:h-6 sm:w-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:gap-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative aspect-[1.62] overflow-hidden rounded-[4px] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-800 focus:ring-offset-2 sm:rounded-md"
            aria-label={`Open gallery image ${index + 1}`}
          >
            <Image
              src={item.image_url}
              alt={item.caption || `Gallery image ${index + 1}`}
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              unoptimized
            />
          </button>
        ))}
      </div>

      {activeItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image preview"
        >
          <button type="button" aria-label="Close image preview" className="absolute inset-0 cursor-default" onClick={close} />
          <div className="relative z-10 w-full max-w-6xl px-4">
            <button
              type="button"
              aria-label="Close image preview"
              onClick={close}
              className="absolute right-6 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-black shadow-lg"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Previous image"
              onClick={showPrevious}
              className="absolute left-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lg sm:left-6 sm:h-12 sm:w-12"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.6] sm:h-6 sm:w-6" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={showNext}
              className="absolute right-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lg sm:right-6 sm:h-12 sm:w-12"
            >
              <ChevronRight className="h-5 w-5 stroke-[2.6] sm:h-6 sm:w-6" />
            </button>
            <div className="relative h-[82vh] w-full">
              <Image
                src={activeItem.image_url}
                alt={activeItem.caption || `Gallery image ${activeIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
                priority
                unoptimized
              />
            </div>
            <div className="mx-auto mt-4 max-w-3xl text-center text-sm font-medium text-white/80">
              {activeItem.caption || `${activeIndex + 1} of ${total}`}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
