"use client";
import { useState, useRef } from "react";
import { Images, ArrowRight, Upload, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { compressImageIfNeeded } from "@/lib/imageCompression";
import Modal from "@/components/ui/Modal";

// Same target size reasoning as the full Gallery page's own constant --
// uploads go straight to R2 via a presigned URL, not through a Vercel
// function body, so this isn't bound by that platform's ~4.5MB request cap.
const GALLERY_COMPRESSION_TARGET_BYTES = 4.5 * 1024 * 1024;

// One-image quick add, reusing the exact same presigned-upload + finalize
// flow as the full Gallery page (apps/dashboard/src/app/dashboard/gallery/
// page.js's uploadDirect/uploadLegacy) -- just scoped to a single file
// with no reorder/caption/delete UI, since this only exists to clear the
// "add at least one image" checklist item quickly.
export default function GalleryQuickAddModal({ isOpen, onClose, onAdded }) {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadDirect = async (file) => {
    const uploadInit = await secureApiCall('/api/gallery/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size
      })
    });

    if (!uploadInit?.success || !uploadInit?.data?.uploadUrl || !uploadInit?.data?.uploadIntentToken) {
      throw new Error(uploadInit?.message || 'Could not prepare upload');
    }

    const { uploadUrl, requiredHeaders, uploadIntentToken } = uploadInit.data;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: requiredHeaders || { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('Direct image upload failed');
    }

    const finalize = await secureApiCall('/api/gallery/finalize', {
      method: 'POST',
      body: JSON.stringify({ uploadIntentToken, caption: null })
    });

    if (!finalize?.success) {
      throw new Error(finalize?.message || 'Could not finalize upload');
    }

    return finalize.data;
  };

  const uploadLegacy = async (file) => {
    const form = new FormData();
    form.append('image', file);
    const response = await secureApiCall('/api/gallery', { method: 'POST', body: form });
    if (!response.success) throw new Error(response.message);
    return response.data;
  };

  const handleFileSelected = async (file) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const compressed = await compressImageIfNeeded(file, GALLERY_COMPRESSION_TARGET_BYTES);
      try {
        await uploadDirect(compressed);
      } catch (directError) {
        if (directError?.message?.includes('HTTP 404')) {
          await uploadLegacy(compressed);
        } else {
          throw directError;
        }
      }
      onAdded?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a gallery photo"
      subtitle="Make your listing look complete"
      icon={Images}
      footer={
        <button
          onClick={() => router.push('/dashboard/gallery')}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
        >
          Manage Gallery <ArrowRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          One good photo is enough to start -- add more, reorder, and caption them anytime from the full gallery.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50/30 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-60 overflow-hidden relative"
        >
          {preview ? (
            <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          {isUploading ? (
            <div className={preview ? 'absolute inset-0 flex items-center justify-center bg-black/40' : ''}>
              <Loader2 className={`w-6 h-6 animate-spin ${preview ? 'text-white' : 'text-gray-400'}`} />
            </div>
          ) : !preview ? (
            <>
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-500">Tap to choose a photo</span>
            </>
          ) : null}
        </button>
      </div>
    </Modal>
  );
}
