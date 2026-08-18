"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Loader2, Store as StoreIcon, ArrowRight } from "lucide-react";

const DEBOUNCE_MS = 250;

function formatPrice(price) {
  return `₦${Number(price || 0).toLocaleString("en-NG")}`;
}

// Drop-in replacement for SearchBar.js on /products and /vendors: same
// controlled value/onChange contract, plus a live preview dropdown
// underneath -- a few top vendor and product matches as you type.
// Deliberately NOT wired to drive the host page's full results grid on
// every keystroke pause -- that grid query is free-text and uncached
// (unlike the preview, which is cached), so re-running it on every pause
// while someone is still typing/correcting is pure waste. The grid only
// updates when the query is actually committed: picking a specific
// vendor/product navigates straight to it, and "See all N products/M
// vendors" (click, or arrow-key to it and press Enter) is the deliberate
// commit action -- reachable via the same flatItems keyboard nav as any
// other row, so no separate bare-Enter handling is needed. The one
// exception is clearing back to empty (backspace or the × button), which
// commits immediately since an empty query hits the cached default-browse
// view -- there's no expensive query to protect there.
export default function SearchTypeahead({ value, onChange, placeholder, variant = "standalone" }) {
  const embedded = variant === "embedded";
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Keep in sync with the parent's own value (e.g. cleared via the page's
  // "Clear filters" or a browser back-navigation).
  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  // Clearing back to empty commits immediately -- see module comment for
  // why this is the one case that doesn't wait for an explicit commit.
  useEffect(() => {
    if (draft === "" && (value || "") !== "") onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Drives the preview dropdown -- independent, shorter debounce (this is
  // a lightweight, capped-limit query, not the full paginated search).
  useEffect(() => {
    const q = draft.trim();
    if (!q) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/preview?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        if (data.success) setPreview(data);
      } catch (error) {
        if (error.name !== "AbortError") console.error("Error fetching search preview:", error);
      } finally {
        // An aborted (superseded) request's own `finally` must not clear
        // the loading flag out from under the newer request that replaced
        // it -- only the request that's still current gets to touch it.
        if (!controller.signal.aborted) setLoadingPreview(false);
      }
    }, DEBOUNCE_MS);

    // Cancels both a still-pending debounce timer AND an already-in-flight
    // request from the previous keystroke -- without this, a slow response
    // for an older, superseded query can resolve after a newer one and
    // silently overwrite it with stale results.
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft]);

  useEffect(() => {
    setHighlighted(-1);
  }, [preview]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = draft.trim();
  const vendors = preview?.vendors || [];
  const products = preview?.products || [];
  const hasResults = vendors.length > 0 || products.length > 0;

  // Flattened so arrow keys can move through vendors -> products -> the
  // "see all" links as one linear list, regardless of section boundaries.
  // Derives vendors/products from `preview` inside the memo itself (rather
  // than depending on the `|| []`-derived consts above, which are a new
  // array reference every render) so this only recomputes when `preview`
  // or `q` actually change.
  const flatItems = useMemo(() => {
    const previewVendors = preview?.vendors || [];
    const previewProducts = preview?.products || [];
    const items = [
      ...previewVendors.map((v) => ({ type: "vendor", href: `/${v.storeSlug}` })),
      ...previewProducts.map((p) => ({ type: "product", href: `/${p.store?.storeSlug}/product/${p.id}` }))
    ];
    if (preview?.productTotal > previewProducts.length) {
      items.push({ type: "seeAllProducts", href: `/products?q=${encodeURIComponent(q)}` });
    }
    if (preview?.vendorTotal > previewVendors.length) {
      items.push({ type: "seeAllVendors", href: `/vendors?q=${encodeURIComponent(q)}` });
    }
    return items;
  }, [preview, q]);

  // "See all N products" while already on /products (same for vendors) is
  // a commit, not a navigation -- the page only reads its query from the
  // URL once on mount, so pushing the same route with a different `q`
  // wouldn't actually update anything. Everything else (a specific vendor/
  // product, or "See all" for the *other* page) is a real navigation.
  const go = (href) => {
    setOpen(false);
    inputRef.current?.blur();
    if (href.split("?")[0] === pathname) {
      onChange(q);
      return;
    }
    router.push(href);
  };

  const handleKeyDown = (e) => {
    if (!open || flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      go(flatItems[highlighted].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {!embedded && (
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      )}
      <div className={embedded ? "flex items-center gap-1.5 w-full" : ""}>
        {embedded && <Search className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-typeahead-listbox"
          aria-autocomplete="list"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={
            // text-base (16px) on mobile -- iOS Safari zooms the viewport in
            // on focus for any input under 16px, which is the "zoom in
            // effect" this is fixing. sm: drops back to the original
            // text-sm once iOS zoom is no longer a concern.
            embedded
              ? "w-full min-w-0 bg-transparent outline-none text-base sm:text-sm font-medium text-brand-900 placeholder-gray-400"
              : "w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-colors"
          }
        />
      </div>
      {draft ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            inputRef.current?.focus();
          }}
          className={
            embedded
              ? "absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              : "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          }
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : loadingPreview && !embedded ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />
      ) : null}

      {open && q && (
        <div
          id="search-typeahead-listbox"
          role="listbox"
          className={`absolute top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_32px_rgba(11,59,46,0.12)] overflow-hidden z-30 max-h-[70vh] overflow-y-auto ${
            // Embedded dropdown matches the input's own width on mobile
            // (left-0 right-0, same as the standalone variant) so it's
            // centered under the search bar instead of a fixed 22rem box
            // anchored to the left edge. Reverts to that fixed left-anchored
            // width at sm: and up, unchanged from before.
            embedded ? "left-0 right-0 sm:right-auto sm:w-[22rem]" : "left-0 right-0"
          }`}
        >
          {loadingPreview && !preview ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : !hasResults ? (
            <div className="p-5 text-center">
              <p className="text-sm text-gray-400">No matches for &ldquo;{q}&rdquo;</p>
            </div>
          ) : (
            <>
              {vendors.length > 0 && (
                <div className="py-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Vendors</p>
                  {vendors.map((v, i) => {
                    const idx = i;
                    return (
                      <button
                        key={v.id}
                        role="option"
                        aria-selected={highlighted === idx}
                        onMouseEnter={() => setHighlighted(idx)}
                        onClick={() => go(`/${v.storeSlug}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          highlighted === idx ? "bg-brand-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-brand-700"
                          style={{ backgroundColor: v.branding?.primaryColor || "#145C41" }}
                        >
                          {v.branding?.logo ? (
                            <img src={v.branding.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <StoreIcon className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">{v.storeName}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {products.length > 0 && (
                <div className={`py-2 ${vendors.length > 0 ? "border-t border-gray-100" : ""}`}>
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Products</p>
                  {products.map((p, i) => {
                    const idx = vendors.length + i;
                    return (
                      <button
                        key={p.id}
                        role="option"
                        aria-selected={highlighted === idx}
                        onMouseEnter={() => setHighlighted(idx)}
                        onClick={() => go(`/${p.store?.storeSlug}/product/${p.id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          highlighted === idx ? "bg-brand-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-sm text-gray-900 truncate flex-1">{p.productName}</span>
                        <span className="text-xs font-semibold text-gray-500 tabular-nums flex-shrink-0">
                          {formatPrice(p.sellingPrice)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {(preview?.productTotal > products.length || preview?.vendorTotal > vendors.length) && (
                <div className="border-t border-gray-100 py-1.5">
                  {preview.productTotal > products.length && (
                    <button
                      role="option"
                      aria-selected={highlighted === flatItems.findIndex((i) => i.type === "seeAllProducts")}
                      onMouseEnter={() => setHighlighted(flatItems.findIndex((i) => i.type === "seeAllProducts"))}
                      onClick={() => go(`/products?q=${encodeURIComponent(q)}`)}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-brand-700 transition-colors ${
                        highlighted === flatItems.findIndex((i) => i.type === "seeAllProducts") ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                    >
                      See all {preview.productTotal.toLocaleString()} products
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {preview.vendorTotal > vendors.length && (
                    <button
                      role="option"
                      aria-selected={highlighted === flatItems.findIndex((i) => i.type === "seeAllVendors")}
                      onMouseEnter={() => setHighlighted(flatItems.findIndex((i) => i.type === "seeAllVendors"))}
                      onClick={() => go(`/vendors?q=${encodeURIComponent(q)}`)}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-brand-700 transition-colors ${
                        highlighted === flatItems.findIndex((i) => i.type === "seeAllVendors") ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                    >
                      See all {preview.vendorTotal.toLocaleString()} vendors
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
