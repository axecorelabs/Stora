"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const MAX_WIDTH_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl'
};

const ICON_TONE_CLASSES = {
  brand: 'bg-brand-100 text-brand-800',
  gold: 'bg-gold-500/15 text-gold-600'
};

// Shared shell every checklist quick-edit modal (and, over time, anything
// else needing a mobile-first modal) mounts into -- no such shared
// component existed before this, so each of the ~18 modals in this app
// hand-rolled its own plain centered dialog with no mobile-specific
// treatment and no enter/exit transition at all (an abrupt conditional
// unmount). This fixes both at the source: a real bottom sheet below
// `sm:` (drag handle, safe-area-aware bottom padding, slides up/down)
// and a centered dialog at `sm:` and up (scale + fade), both driven by a
// mount-then-animate-in / animate-out-then-unmount cycle rather than the
// instant pop-in/out every other modal here still has.
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconTone = 'brand',
  size = 'md',
  footer,
  children
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // One frame late so the browser paints the closed (translated/
      // scaled-down) state first -- flipping both mount and the visible
      // class in the same tick would skip the transition entirely.
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    // Matches the transition duration below -- unmounts only once the
    // exit animation has actually finished playing.
    const timeout = setTimeout(() => setShouldRender(false), 300);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  const maxWidthClass = MAX_WIDTH_CLASSES[size] || MAX_WIDTH_CLASSES.md;
  const toneClass = ICON_TONE_CLASSES[iconTone] || ICON_TONE_CLASSES.brand;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`relative w-full ${maxWidthClass} bg-white rounded-t-3xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl transform transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          isVisible
            ? 'translate-y-0 sm:scale-100 opacity-100'
            : 'translate-y-full sm:translate-y-4 sm:scale-95 opacity-0'
        }`}
      >
        {/* Drag-handle affordance -- mobile only, signals "this sheet can
            be dismissed" the way a centered dialog's X button already does. */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${toneClass}`}>
                <Icon className="w-4.5 h-4.5" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-gray-100 px-5 sm:px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 bg-gray-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
