"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { compressImageIfNeeded } from "@/lib/imageCompression";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Button from "@/components/ui/Button";
import { Upload, Trash2, GripVertical, Plus, AlertCircle, Loader2 } from "lucide-react";

const MAX_IMAGES = 10;
// Gallery uploads go straight to R2 via a presigned URL (see uploadDirect
// below), never through a Vercel serverless function body -- so unlike
// every other image upload in this app, it isn't bound by that platform's
// ~4.5MB request cap. Its real ceiling is api/gallery/finalize's own
// MAX_DIRECT_UPLOAD_BYTES (5MB); this targets a bit under that to leave
// room for encoding rounding, rather than the shared 2MB default sized
// for everyone else's still-server-proxied uploads.
const GALLERY_COMPRESSION_TARGET_BYTES = 4.5 * 1024 * 1024;

function GalleryItem({ item, onDelete, onCaptionChange, isDragging, dragHandleProps }) {
  const [caption, setCaption] = useState(item.caption || '');
  const [isEditingCaption, setIsEditingCaption] = useState(false);

  const handleCaptionBlur = () => {
    setIsEditingCaption(false);
    if (caption !== (item.caption || '')) {
      onCaptionChange(item.id, caption);
    }
  };

  return (
    <div className={`bg-white border border-gray-100 rounded-xl overflow-hidden transition-shadow ${isDragging ? 'shadow-lg' : 'shadow-sm'}`}>
      <div className="relative aspect-video bg-gray-50">
        <img src={item.image_url} alt={caption || 'Gallery image'} className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <button
            {...dragHandleProps}
            className="w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 bg-red-500/80 hover:bg-red-600 text-white rounded-lg flex items-center justify-center"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3">
        {isEditingCaption ? (
          <input
            autoFocus
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={handleCaptionBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="Add a caption…"
            maxLength={120}
            className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-transparent"
          />
        ) : (
          <button
            onClick={() => setIsEditingCaption(true)}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-700 truncate py-0.5"
          >
            {caption || <span className="italic text-gray-400">Click to add a caption</span>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const { secureApiCall } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOrder, setDragOrder] = useState(null); // local drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const { data: galleryData, isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => secureApiCall('/api/gallery'),
    staleTime: 2 * 60 * 1000
  });

  const items = dragOrder || galleryData?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => secureApiCall(`/api/gallery/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery'] })
  });

  const reorderMutation = useMutation({
    mutationFn: (updatedItems) => secureApiCall('/api/gallery', {
      method: 'PATCH',
      body: JSON.stringify({ items: updatedItems.map((item, idx) => ({ id: item.id, sort_order: idx })) })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setDragOrder(null);
    }
  });

  const captionMutation = useMutation({
    mutationFn: ({ id, caption }) => secureApiCall('/api/gallery', {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ id, caption }] })
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery'] })
  });

  const uploadLegacy = async (file) => {
    const form = new FormData();
    form.append('image', file);
    const response = await secureApiCall('/api/gallery', { method: 'POST', body: form });
    if (!response.success) throw new Error(response.message);
    return response.data;
  };

  const uploadDirect = async (file) => {
    const uploadInit = await secureApiCall('/api/gallery/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
      })
    });

    if (!uploadInit?.success || !uploadInit?.data?.uploadUrl || !uploadInit?.data?.uploadIntentToken) {
      throw new Error(uploadInit?.message || 'Could not prepare upload');
    }

    const { uploadUrl, requiredHeaders, uploadIntentToken } = uploadInit.data;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: requiredHeaders || { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Direct image upload failed');
    }

    const finalize = await secureApiCall('/api/gallery/finalize', {
      method: 'POST',
      body: JSON.stringify({
        uploadIntentToken,
        caption: null,
      })
    });

    if (!finalize?.success) {
      throw new Error(finalize?.message || 'Could not finalize upload');
    }

    return finalize.data;
  };

  const handleUpload = async (files) => {
    setUploadError(null);
    let currentCount = items.length;
    for (const file of Array.from(files)) {
      if (currentCount >= MAX_IMAGES) {
        setUploadError(`Gallery is full -- maximum ${MAX_IMAGES} images.`);
        break;
      }
      setUploading(true);
      try {
        const compressed = await compressImageIfNeeded(file, GALLERY_COMPRESSION_TARGET_BYTES);

        try {
          await uploadDirect(compressed);
        } catch (directError) {
          // Rollout safety: if signed-upload routes aren't available yet,
          // keep uploads working via the existing multipart endpoint.
          if (directError?.message?.includes('HTTP 404')) {
            await uploadLegacy(compressed);
          } else {
            throw directError;
          }
        }

        currentCount += 1;
        queryClient.invalidateQueries({ queryKey: ['gallery'] });
      } catch (err) {
        setUploadError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    }
  };

  // Simple drag-and-drop reorder
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    const currentItems = galleryData?.data || [];
    const from = currentItems.findIndex(i => i.id === draggingId);
    const to = currentItems.findIndex(i => i.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...currentItems];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setDragOrder(reordered);
    reorderMutation.mutate(reordered);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <DashboardLayout title="Gallery" subtitle="Manage your showcase images">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{items.length} of {MAX_IMAGES} images</p>
          </div>
          {items.length < MAX_IMAGES && (
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Add image'}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {uploadError}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-video animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Upload your first image</p>
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG or WebP, up to 5MB each (auto-compressed before upload)</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                className={`transition-opacity ${draggingId === item.id ? 'opacity-40' : dragOverId === item.id ? 'ring-2 ring-brand-800 ring-offset-1 rounded-xl' : ''}`}
              >
                <GalleryItem
                  item={item}
                  isDragging={draggingId === item.id}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onCaptionChange={(id, caption) => captionMutation.mutate({ id, caption })}
                  dragHandleProps={{}}
                />
              </div>
            ))}

            {/* Upload slot */}
            {items.length < MAX_IMAGES && (
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="w-6 h-6 text-gray-300" />
                <span className="text-xs text-gray-400 mt-1">Add photo</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Drag images to reorder. Click on a caption to edit it. Images are displayed on your public showcase page.
        </p>
      </div>
    </DashboardLayout>
  );
}
