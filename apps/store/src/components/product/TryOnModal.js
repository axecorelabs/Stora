"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, ImagePlus, Sparkles, Loader2, RotateCcw, Download, ShoppingCart, AlertCircle } from "lucide-react";
import TurnstileWidget, { TURNSTILE_ENABLED } from "@/components/ui/TurnstileWidget";
import { compressImageIfNeeded } from "@/lib/imageCompression";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

// Phases: 'select' (photo + consent + turnstile) -> 'uploading' ->
// 'generating' (polling) -> 'result' | 'error'. Full-screen bottom sheet
// on mobile (h-screen sm:h-auto, rounded-t-3xl sm:rounded-2xl), matching
// VariantSelectionModal.js's own established shell -- this is the
// heaviest-traffic modal on the whole page (a real photo upload + a
// 10-50s wait), so it gets the same mobile-first treatment as every
// other modal on this page, not a smaller/lighter one.
export default function TryOnModal({ isOpen, onClose, product, primaryColor = '#0D9488', onAddToCart }) {
  const [phase, setPhase] = useState('select');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const pollDeadlineRef = useRef(null);

  const resetState = useCallback(() => {
    setPhase('select');
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setConsentChecked(false);
    setTurnstileToken("");
    setTurnstileError(false);
    setError("");
    setResultUrl(null);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
  }, [previewUrl]);

  // Every path that closes this modal originates from a click inside it
  // (backdrop, X, or a successful add-to-cart) -- resetting state right
  // there, rather than reactively off an isOpen-watching effect, avoids
  // the cascading-render setState-in-effect pattern for no loss of
  // behavior, since there's no external "isOpen flipped false" case to
  // react to.
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  useEffect(() => {
    return () => { if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after "retake"
    if (!file || !file.type?.startsWith('image/')) return;

    setError("");
    const compressed = await compressImageIfNeeded(file, MAX_UPLOAD_BYTES);
    if (compressed.size > MAX_UPLOAD_BYTES) {
      setError("This photo is too large. Please choose a smaller one.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(compressed);
    setPreviewUrl(URL.createObjectURL(compressed));
  };

  const pollGeneration = (generationId) => {
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    const tick = async () => {
      try {
        const res = await fetch(`/api/tryon/generations/${generationId}`, { credentials: 'include' });
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "Something went wrong. Please try again.");
          setPhase('error');
          return;
        }

        if (data.data.status === 'succeeded') {
          setResultUrl(data.data.resultUrl);
          setPhase('result');
          return;
        }

        if (data.data.status === 'failed') {
          setError(data.data.errorMessage || "We couldn't generate your try-on. Please try again.");
          setPhase('error');
          return;
        }

        if (Date.now() > pollDeadlineRef.current) {
          setError("This is taking longer than expected. Please try again.");
          setPhase('error');
          return;
        }

        pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        console.error('Try-on poll error:', err);
        setError("Something went wrong. Please try again.");
        setPhase('error');
      }
    };

    tick();
  };

  const handleSubmit = async () => {
    if (!selectedFile || !consentChecked) return;
    if (TURNSTILE_ENABLED && !turnstileToken) return;

    setError("");
    setPhase('uploading');

    try {
      const presignRes = await fetch('/api/tryon/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contentType: selectedFile.type,
          contentLength: selectedFile.size,
          consentGiven: true,
          turnstileToken
        })
      });
      const presignData = await presignRes.json();
      if (!presignData.success) {
        setError(presignData.message || "Failed to start upload.");
        setPhase('error');
        return;
      }

      const { uploadId, uploadUrl, uploadIntentToken, requiredHeaders } = presignData.data;

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: requiredHeaders,
        body: selectedFile
      });
      if (!putRes.ok) {
        setError("Failed to upload your photo. Please try again.");
        setPhase('error');
        return;
      }

      const finalizeRes = await fetch('/api/tryon/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uploadId, uploadIntentToken })
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeData.success) {
        setError(finalizeData.message || "Failed to confirm upload.");
        setPhase('error');
        return;
      }

      setPhase('generating');
      const generateRes = await fetch('/api/tryon/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uploadId, inventoryId: product.id })
      });
      const generateData = await generateRes.json();
      if (!generateData.success) {
        setError(generateData.message || "Failed to start generation.");
        setPhase('error');
        return;
      }

      pollGeneration(generateData.data.generationId);
    } catch (err) {
      console.error('Try-on submit error:', err);
      setError("Something went wrong. Please try again.");
      setPhase('error');
    }
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setPhase('select');
  };

  const handleAddToCartClick = async () => {
    setIsAddingToCart(true);
    try {
      await onAddToCart?.();
      resetState();
    } finally {
      setIsAddingToCart(false);
    }
  };

  const canSubmit = selectedFile && consentChecked && (!TURNSTILE_ENABLED || turnstileToken);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={phase === 'uploading' || phase === 'generating' ? undefined : handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full sm:max-w-lg bg-white shadow-xl rounded-t-3xl sm:rounded-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Drag-handle affordance, mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
              style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
            >
              <Sparkles className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 text-base sm:text-lg truncate">AI Try-On</h2>
              <p className="text-xs text-gray-500 truncate">{product.productName || product.name}</p>
            </div>
          </div>
          {phase !== 'uploading' && phase !== 'generating' && (
            <button
              onClick={handleClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
          {phase === 'select' && (
            <div className="space-y-5">
              {!previewUrl ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <Camera className="w-7 h-7 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Take a photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <ImagePlus className="w-7 h-7 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Choose photo</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <img src={previewUrl} alt="Your photo" className="w-full rounded-2xl max-h-72 object-cover" />
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium backdrop-blur-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Change
                  </button>
                </div>
              )}

              <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFileSelect} className="hidden" />
              <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

              <p className="text-xs text-gray-500 leading-relaxed">
                For best results, use a clear, well-lit photo facing the camera, from the waist up.
              </p>

              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 shrink-0"
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I agree to let Stora process my photo using AI to generate this preview. My photo and the result are automatically deleted within 48 hours and are never shared publicly. See our{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: primaryColor }}>AI Try-On Terms</a>.
                </span>
              </label>

              {TURNSTILE_ENABLED && (
                <div className="flex justify-center">
                  <TurnstileWidget
                    onVerify={(token) => { setTurnstileToken(token); setTurnstileError(false); }}
                    onError={() => { setTurnstileToken(""); setTurnstileError(true); }}
                  />
                </div>
              )}
              {turnstileError && (
                <p className="text-xs text-red-600 text-center">Verification failed. Please try again.</p>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {(phase === 'uploading' || phase === 'generating') && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="relative w-16 h-16 mb-5">
                {previewUrl && (
                  <img src={previewUrl} alt="" className="w-16 h-16 rounded-full object-cover opacity-40" />
                )}
                <Loader2 className="w-16 h-16 absolute inset-0 animate-spin" style={{ color: primaryColor }} />
              </div>
              <p className="font-semibold text-gray-900">
                {phase === 'uploading' ? 'Uploading your photo…' : 'Creating your look…'}
              </p>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xs">
                {phase === 'uploading' ? 'This should only take a moment.' : 'This can take up to a minute. Feel free to wait right here.'}
              </p>
            </div>
          )}

          {phase === 'result' && resultUrl && (
            <div className="space-y-4">
              <img src={resultUrl} alt={`You wearing ${product.productName || product.name}`} className="w-full rounded-2xl" />
              <p className="text-xs text-gray-400 text-center">
                AI-generated preview -- actual product may vary. This image will be deleted within 48 hours.
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="font-semibold text-gray-900">Couldn&apos;t generate your try-on</p>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xs">{error}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 sm:px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 bg-gray-50/50">
          {phase === 'select' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-95"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="w-5 h-5" />
              Generate my try-on
            </button>
          )}

          {phase === 'result' && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={resultUrl}
                download
                className="w-full sm:w-auto flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Save image
              </a>
              {onAddToCart && (
                <button
                  type="button"
                  onClick={handleAddToCartClick}
                  disabled={isAddingToCart}
                  className="w-full sm:w-auto flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isAddingToCart ? 'Adding…' : 'Add to cart'}
                </button>
              )}
            </div>
          )}

          {phase === 'error' && (
            <button
              type="button"
              onClick={handleRetake}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold transition-colors flex items-center justify-center gap-2 hover:brightness-95"
              style={{ backgroundColor: primaryColor }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
