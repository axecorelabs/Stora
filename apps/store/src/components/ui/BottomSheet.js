"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

// The mobile-only counterpart to a popover -- filters/sort need real room
// to breathe (wrapped pill grids, a searchable state list), which a small
// anchored dropdown can't give on a narrow screen. Slides up from the
// bottom, matching the interaction language already used for the mobile
// nav panel in SiteHeader.js (backdrop + sliding panel), just anchored to
// the bottom edge instead of the side.
export default function BottomSheet({ isOpen, onClose, title, children, footer }) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(11,59,46,0.16)] max-h-[85vh] flex flex-col animate-[sheet-up_0.25s_ease-out]">
        <div className="flex items-center justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-display text-base font-bold text-brand-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>

        {footer && <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">{footer}</div>}
      </div>

      <style jsx>{`
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
