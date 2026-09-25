"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Building2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const categoryLabel = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Business");

// Onboarding wizard step: "is your business already on Stora?" -- lets a
// signee search unclaimed listings by name and jump straight into the
// existing claim flow (ClaimBusinessStep.js) instead of only ever
// discovering "claim" by stumbling onto their own storefront page. See the
// Part I plan.
export default function FindBusinessStep({ onFound, onSkip, onBack }) {
  const { secureApiCall } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  // Query too short: no fetch, and nothing renders below regardless of
  // whatever searchResults still holds from a longer query typed earlier --
  // derived here rather than reset via setState inside the effect.
  const results = query.trim().length >= 2 ? searchResults : [];

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await secureApiCall(`/api/claims/search?q=${encodeURIComponent(query.trim())}`);
        setSearchResults(response?.success ? response.data : []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, secureApiCall]);

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <h1 className="text-lg font-semibold text-gray-900 mb-1.5">Is your business already on Stora?</h1>
      <p className="text-sm text-gray-500 mb-6">
        Search by name -- if we already have a listing for it, you can claim it instead of starting over.
      </p>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your business name"
          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
        />
      </div>

      {isSearching && (
        <p className="text-sm text-gray-400 mb-4">Searching…</p>
      )}

      {!isSearching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">No matches -- you can create a new listing below.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 mb-6">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onFound(result.id)}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-brand-800 hover:bg-brand-50 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-brand-800" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{result.storeName}</p>
                <p className="text-xs text-gray-500">
                  {categoryLabel(result.businessCategory)}{result.state ? ` · ${result.state}` : ""}
                </p>
              </div>
              <span className="text-xs font-semibold text-brand-800 flex-shrink-0">Claim it</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
      >
        Can&apos;t find it? Create a new business instead
      </button>
    </div>
  );
}
