"use client";
import { Upload, Check, Trash2, ImageIcon, Info, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { PRODUCT_COLORS, PRODUCT_COLOR_HEX } from "@/lib/productColors";

export default function ImageUploadSection({
  hasVariants,
  category,
  imagePreviews,
  multiImageInputRef,
  handleMultiImageSelect,
  removeMultiImage,
  updateImageColorTag,
  setPrimaryImage,
  onVariantsDetected, // New prop to notify parent about detected variants
  errors
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if category supports color tagging -- 'Other' is the catch-all
  // for items that don't fit any specific category, not a reason to
  // withhold a generic feature every other category already gets.
  const supportsColorTagging = (
    category === 'Clothing' ||
    category === 'Shoes' ||
    category === 'Accessories' ||
    category === 'Electronics' ||
    category === 'Sports' ||
    category === 'Home & Garden' ||
    category === 'Other' ||
    category === 'Wigs & Hair'
  );

  // The "Product Variants" guidance banner below should show anywhere
  // color tagging itself is offered -- variant detection (AddInventoryModal's
  // handleVariantsDetected) already runs off tagged colors alone, with no
  // category check of its own, so gating this banner to a narrower list
  // than supportsColorTagging just left some of those categories without
  // the in-context explanation for a feature that already worked for them.
  const canEnableVariants = supportsColorTagging;

  // Full color list lives in one place (apps/dashboard/src/lib/productColors.js)
  // now, shared by every screen that offers color tagging -- was a ~30-name
  // array hardcoded here.
  const commonColorNames = PRODUCT_COLORS.map(c => c.name);

  // Colors already tagged on this product's own images -- surfaced first
  // in the dropdown, ahead of the general palette. Derived straight from
  // imagePreviews (whose colorTag persists via inventory.images, written
  // unconditionally regardless of category) rather than the old per-category
  // formData.xDetails.colors, which never actually reached the database for
  // any category except Food/Beverages/Books -- see apps/dashboard/src/app/api/inventory/route.js.
  // This also means it now works identically for every category, including
  // Wigs & Hair and Other, which never had a details.colors field at all.
  const availableColors = [...new Set(imagePreviews.map(img => img.colorTag).filter(Boolean))];
  const allColors = [
    ...availableColors,
    ...commonColorNames.filter(color => !availableColors.includes(color))
  ];

  // Color options for dropdown -- swatch is looked up by name, so a color
  // a vendor already had on file (from before this list existed, or a
  // name that doesn't match any preset) just renders without a dot rather
  // than breaking.
  const colorDropdownOptions = [
    { value: '', label: 'No color tag' },
    ...allColors.map(color => ({
      value: color,
      label: color,
      swatch: PRODUCT_COLOR_HEX[color]
    }))
  ];

  // Detect color variants from tagged images
  useEffect(() => {
    if (!imagePreviews || imagePreviews.length === 0) return;

    const colorTaggedImages = imagePreviews.filter(img => img.colorTag && img.colorTag !== '');
    const uniqueColors = [...new Set(colorTaggedImages.map(img => img.colorTag))];

    // If user has tagged 2 or more images with different colors, we detected variants
    if (uniqueColors.length >= 2) {
      onVariantsDetected(uniqueColors);
    } else {
      onVariantsDetected([]);
    }
    // onVariantsDetected is now stabilized with useCallback in every
    // caller (add/page.js, AddInventoryModal.js, EditInventoryModal.js),
    // so listing it here doesn't re-run this effect on every unrelated
    // keystroke -- only when imagePreviews actually changes, or the
    // callback's own real dependencies do (e.g. add/page.js's category).
  }, [imagePreviews, onVariantsDetected]);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <ImageIcon className="w-5 h-5 mr-2 text-gray-600" />
        Product Images
      </h3>

      {/* Variant Mode Toggle - Only for applicable categories */}
      {canEnableVariants && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-brand-900">
                    Product Variants
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="p-1 text-brand-700 hover:bg-brand-100 rounded-full transition-colors"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    
                    {/* Tooltip */}
                    {showTooltip && (
                      <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-xl z-10">
                        <div className="font-medium mb-2">What are variants?</div>
                        <p className="mb-2">
                          Variants are different versions of the same product with combinations of:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li><strong>Size:</strong> S, M, L, XL, or shoe sizes like 40, 41, 42</li>
                          <li><strong>Color:</strong> Red, Blue, Black, etc.</li>
                        </ul>
                        <p className="mt-2 text-xs text-gray-300">
                          Example: A red T-shirt in size M is one variant, the same T-shirt in blue size L is another variant.
                        </p>
                        {/* Arrow */}
                        <div className="absolute -top-2 left-4 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900"></div>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-brand-700 mt-1">
                  {hasVariants 
                    ? "✓ System detected multiple color variants from your tagged images"
                    : "Tag 2 or more images with different colors to enable variant tracking"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Section - Always Multiple */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product Images (Max 10) *
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Upload multiple product images. {supportsColorTagging && "Tag them with colors to organize your gallery if your product has different variants."}
        </p>

        {/* Image Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="flex flex-col space-y-2">
              {/* Image Container */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 group">
                {/* fill, not width/height: this tile's rendered size is
                    responsive (2/3/4/5-column grid), not a fixed pixel
                    box, so fill + the aspect-square parent (already
                    position:relative) is the correct mode here -- matches
                    apps/store's own images.remotePatterns entries for
                    these same URLs (R2's storage.stora.com.ng/*.r2.dev,
                    plus the legacy Wasabi host for pre-migration images),
                    now mirrored in next.config.mjs. preview.url for an
                    unsaved new upload is a data: URI straight from
                    FileReader, which next/image also renders directly. */}
                <Image
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  className="object-cover"
                />
                
                {/* Primary Badge */}
                {preview.isPrimary && (
                  <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-2 py-1 rounded-md font-medium shadow-md">
                    Main
                  </div>
                )}

                {/* Color Tag Badge */}
                {supportsColorTagging && preview.colorTag && (
                  <div className="absolute bottom-2 left-2 bg-white/90 text-gray-900 text-xs px-2 py-1 rounded-md font-medium shadow-sm">
                    {preview.colorTag}
                  </div>
                )}

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!preview.isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(index)}
                      className="p-2 bg-white text-teal-600 rounded-lg hover:bg-teal-50 transition-colors shadow-lg"
                      title="Set as main image"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMultiImage(index)}
                    className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors shadow-lg"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Color Tag Selector Below Image - Show if category supports colors */}
              {supportsColorTagging && (
                <div className="w-full">
                  <CustomDropdown
                    options={colorDropdownOptions}
                    value={preview.colorTag}
                    onChange={(value) => updateImageColorTag(index, value)}
                    placeholder="Tag color"
                    className="text-xs"
                    searchable
                  />
                </div>
              )}
            </div>
          ))}

          {/* Upload Button */}
          {imagePreviews.length < 10 && (
            <div className="flex flex-col space-y-2">
              <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                <input
                  ref={multiImageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMultiImageSelect}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500 text-center px-2">
                  {imagePreviews.length === 0 ? 'Add Images' : 'Add More'}
                </span>
              </label>
              {supportsColorTagging && (
                <div className="h-[42px]"></div>
              )}
            </div>
          )}
        </div>

        {errors.images && (
          <p className="text-red-500 text-xs mt-1">{errors.images}</p>
        )}

        {/* Helper Text */}
        {imagePreviews.length > 0 && (
          <div className="flex items-start space-x-2 p-3 bg-gold-400/10 rounded-lg border border-gold-500/25">
            <Sparkles className="w-4 h-4 text-gold-700 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-brand-900/80">
              <p className="font-medium mb-1">Quick Tips:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {supportsColorTagging ? (
                  <>
                    <li>Use the dropdown below each image to tag it with a color</li>
                    {hasVariants && <li>Tagged images will be linked to specific color variants</li>}
                    <li>Click the check icon to set the main display image</li>
                  </>
                ) : (
                  <>
                    <li>Upload multiple angles/views of your product</li>
                    <li>The first image (marked &quot;Main&quot;) will be the primary display</li>
                    <li>Click the check icon on any image to make it the main image</li>
                  </>
                )}
                <li>You can upload up to 10 images total</li>
              </ul>
            </div>
          </div>
        )}

        {/* No Images Warning */}
        {imagePreviews.length === 0 && (
          <div className="flex items-start space-x-2 p-3 bg-gold-400/10 rounded-lg border border-gold-500/25">
            <Sparkles className="w-4 h-4 text-gold-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-brand-900/80">
              <strong>Tip:</strong> Upload at least one product image. Good photos help customers see what they&apos;re buying!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
