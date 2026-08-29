"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Package, Tag, DollarSign, ChevronLeft, Check, UtensilsCrossed } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useInventoryData } from "@/hooks/useInventoryData";
import { compressImageIfNeeded } from "@/lib/imageCompression";
import ImageUploadSection from "@/components/dashboard/Inventory/ImageUploadSection";
import FoodDetailsSection from "@/components/dashboard/Inventory/Categories/FoodDetailsSection";

// Dedicated menu-item flow for Restaurant Mode stores -- category is always
// 'Food' (no dropdown, no other category ever reachable here; a restaurant
// that also sells non-food items uses the generic /dashboard/inventory/add,
// unaffected by this page existing). Food never supports the color-tagging/
// variant-detection flow (see ImageUploadSection.js's supportsColorTagging),
// so unlike the generic add flow, this page has no VariantManager/color
// machinery at all -- every menu item gets the single default variant
// /api/inventory's own POST handler already creates when no variants array
// is sent. A vendor who genuinely needs sized variants (Small/Medium/Large)
// still has the generic flow available via "Add Other Item" for that.
export default function AddMenuItemPage() {
  const router = useRouter();
  const { secureFormDataCall } = useAuth();
  const { addItem } = useInventoryData();
  const multiImageInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    productName: '',
    category: 'Food',
    description: '',
    brand: '',
    unitOfMeasure: 'Plate (Takeaway)',
    quantityInStock: '',
    reorderLevel: '',
    costPrice: '',
    sellingPrice: '',
    supplier: '',
    location: 'Main Store',
    notes: '',
    tags: [],
    foodDetails: {
      foodType: '',
      cuisineType: [],
      servingSize: '',
      ingredients: [],
      allergens: [],
      spiceLevel: '',
      extras: [],
      deliveryTime: { value: '', unit: 'minutes' },
      menuSection: 'Other'
    }
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const tagOptions = [
    { value: 'New arrivals', label: 'New arrivals' },
    { value: 'Best sellers', label: 'Best sellers' },
    { value: 'Limited edition', label: 'Limited edition' },
    { value: 'Clearance', label: 'Clearance' },
    { value: 'Sale', label: 'Sale' },
    { value: 'Hot deal', label: 'Hot deal' },
    { value: 'Trending', label: 'Trending' },
    { value: 'Featured', label: 'Featured' }
  ];

  const unitOptions = [
    { value: 'Plate (Takeaway)', label: 'Plate (Takeaway)' },
    { value: 'Pack', label: 'Pack' },
    { value: 'Bowl', label: 'Bowl' },
    { value: 'Wrap', label: 'Wrap' },
    { value: 'Kg', label: 'Kg' },
    { value: 'Liter', label: 'Liter' },
    { value: 'Box', label: 'Box' },
    { value: 'Dozen', label: 'Dozen' },
    { value: 'Other', label: 'Other' }
  ];

  const steps = [
    { number: 1, title: 'Menu Item', description: 'Name, details & extras' },
    { number: 2, title: 'Photo', description: 'A picture of the dish' },
    { number: 3, title: 'Stock & Pricing', description: 'How much & how many' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCategoryDetailChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      foodDetails: { ...prev.foodDetails, [field]: value }
    }));
  };

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.productName?.trim()) {
        newErrors.productName = 'Please name this menu item';
      }
    } else if (step === 3) {
      if (!formData.quantityInStock || parseFloat(formData.quantityInStock) < 0) {
        newErrors.quantityInStock = 'Please tell us how many you plan to sell';
      }
      if (!formData.reorderLevel || parseFloat(formData.reorderLevel) < 0) {
        newErrors.reorderLevel = 'Please tell us when to warn you';
      }
      if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
        newErrors.costPrice = 'Please tell us how much it costs you to make';
      }
      if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
        newErrors.sellingPrice = "Please tell us how much you'll sell it for";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Same validation/compression/size-limit rules as the generic add flow
  // (see inventory/add/page.js's handleMultiImageSelect) -- kept identical
  // since nothing about them is Food-specific.
  const handleMultiImageSelect = async (e) => {
    const files = Array.from(e.target.files);

    if (selectedImages.length + files.length > 10) {
      setErrors(prev => ({ ...prev, images: 'Maximum 10 images allowed' }));
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const typeValidFiles = files.filter(file => allowedTypes.includes(file.type));
    const compressedFiles = await Promise.all(typeValidFiles.map(compressImageIfNeeded));
    const maxSize = 2 * 1024 * 1024;
    const validFiles = compressedFiles.filter(file => file.size <= maxSize);

    if (validFiles.length !== files.length) {
      setErrors(prev => ({ ...prev, images: 'Some files were invalid (max 2MB, JPEG/PNG/WebP only)' }));
    }

    setSelectedImages(prev => [...prev, ...validFiles]);

    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, {
          url: e.target.result,
          file,
          colorTag: '',
          isPrimary: prev.length === 0 && index === 0
        }]);
      };
      reader.readAsDataURL(file);
    });

    setErrors(prev => ({ ...prev, images: '' }));
  };

  const removeMultiImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const setPrimaryImage = (index) => {
    setImagePreviews(prev => prev.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

  const uploadMultipleImages = async () => {
    if (selectedImages.length === 0) return [];

    setIsUploadingImage(true);
    const uploadedImages = [];

    try {
      for (let i = 0; i < selectedImages.length; i++) {
        const file = selectedImages[i];
        const preview = imagePreviews[i];

        const imageFormData = new FormData();
        imageFormData.append('image', file);

        const response = await secureFormDataCall('/api/inventory/upload-image', imageFormData);

        if (response.success) {
          uploadedImages.push({
            url: response.url,
            colorTag: '',
            isPrimary: preview.isPrimary || false
          });
        }
      }
      return uploadedImages;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    if (cost === 0) return 0;
    return (((selling - cost) / cost) * 100).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateStep(3)) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const uploadedImages = await uploadMultipleImages();

      // No `variants` sent -- /api/inventory's POST handler creates the
      // single default "One Size / Default" variant from these top-level
      // fields when none is provided, exactly like any other simple,
      // non-variant product.
      const payload = {
        ...formData,
        images: uploadedImages,
        quantityInStock: parseFloat(formData.quantityInStock),
        reorderLevel: parseFloat(formData.reorderLevel),
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice)
      };

      await addItem(payload);
      router.push('/dashboard/inventory');
    } catch (error) {
      console.error('Error adding menu item:', error);
      setErrors({ submit: error.message || 'Failed to add menu item. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => router.push('/dashboard/inventory')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            Inventory
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Add Menu Item</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl pb-4 lg:pb-6 mb-4 lg:mb-6">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-100 rounded-xl">
              <UtensilsCrossed className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Add Menu Item</h2>
              <p className="text-sm text-gray-500">Step {currentStep} of 3: {steps[currentStep - 1].title}</p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 pb-2 lg:hidden">
          <div className="flex items-center">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1 last:flex-initial">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${
                  currentStep > step.number
                    ? 'bg-brand-800 text-white'
                    : currentStep === step.number
                    ? 'bg-brand-800 text-white ring-4 ring-brand-100'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > step.number ? <Check className="w-3.5 h-3.5" /> : step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1.5 ${currentStep > step.number ? 'bg-brand-800' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                    currentStep > step.number
                      ? 'bg-brand-800 text-white'
                      : currentStep === step.number
                      ? 'bg-brand-800 text-white ring-4 ring-brand-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${currentStep === step.number ? 'text-brand-800' : 'text-gray-500'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-8 ${currentStep > step.number ? 'bg-brand-800' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            e.stopPropagation();
          }
        }} className="p-6">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-8">
            {currentStep === 1 && (
              <>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-gray-600" />
                    What&apos;s on the menu?
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Menu Item Name *</label>
                      <p className="text-xs text-gray-500 mb-2">What do you call this dish?</p>
                      <input
                        type="text"
                        name="productName"
                        value={formData.productName}
                        onChange={handleChange}
                        placeholder="e.g., Jollof Rice with Chicken"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors.productName ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                      <p className="text-xs text-gray-500 mb-2">Your restaurant or brand name, if different from your store name</p>
                      <input
                        type="text"
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                        placeholder="Optional"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <p className="text-xs text-gray-500 mb-2">Tell shoppers what&apos;s in it, how it&apos;s prepared, anything that sells the dish</p>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        placeholder="e.g., Smoky party-style jollof rice served with grilled chicken and coleslaw"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                      />
                    </div>
                  </div>
                </div>

                <FoodDetailsSection
                  foodDetails={formData.foodDetails}
                  handleCategoryDetailChange={handleCategoryDetailChange}
                />

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tags (optional)</h3>
                  <p className="text-sm text-gray-500 mb-3">Help shoppers find this item easier</p>
                  <div className="flex flex-wrap gap-2">
                    {tagOptions.map(tag => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleTag(tag.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.tags.includes(tag.value)
                            ? 'bg-brand-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Extra information (you can skip these)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Where do you keep this?</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., Kitchen, Main counter"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes to remember</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows={3}
                        placeholder="e.g., Customers love this, needs 24hr notice for large orders"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <ImageUploadSection
                hasVariants={false}
                category="Food"
                imagePreviews={imagePreviews}
                multiImageInputRef={multiImageInputRef}
                handleMultiImageSelect={handleMultiImageSelect}
                removeMultiImage={removeMultiImage}
                updateImageColorTag={() => {}}
                setPrimaryImage={setPrimaryImage}
                onVariantsDetected={() => {}}
                errors={errors}
              />
            )}

            {currentStep === 3 && (
              <>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-gray-600" />
                    How much do you plan to sell?
                  </h3>

                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800">
                      💡 <strong>Note:</strong> Use this to set targets for how much you want to sell this week or month.
                      This helps you plan production and ingredients better!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">How do you serve this? *</label>
                      <p className="text-xs text-gray-500 mb-2">How do you package or serve this?</p>
                      <select
                        name="unitOfMeasure"
                        value={formData.unitOfMeasure}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black bg-white"
                      >
                        {unitOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">How many do you plan to sell? *</label>
                      <p className="text-xs text-gray-500 mb-2">Your sales target (you can update this anytime)</p>
                      <input
                        type="number"
                        name="quantityInStock"
                        value={formData.quantityInStock}
                        onChange={handleChange}
                        min="0"
                        step="1"
                        placeholder="0"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors.quantityInStock ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.quantityInStock && <p className="text-red-500 text-xs mt-1">{errors.quantityInStock}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">When should we warn you? *</label>
                      <p className="text-xs text-gray-500 mb-2">Alert me when I reach this many sales</p>
                      <input
                        type="number"
                        name="reorderLevel"
                        value={formData.reorderLevel}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="5"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors.reorderLevel ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.reorderLevel && <p className="text-red-500 text-xs mt-1">{errors.reorderLevel}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
                    Money stuff
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">How much does it cost you to make one? *</label>
                      <p className="text-xs text-gray-500 mb-2">Calculate ingredients + cooking/production + packaging costs per item</p>
                      <input
                        type="number"
                        name="costPrice"
                        value={formData.costPrice}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors.costPrice ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">How much will you sell it for? *</label>
                      <p className="text-xs text-gray-500 mb-2">How much money will people give you to buy this?</p>
                      <input
                        type="number"
                        name="sellingPrice"
                        value={formData.sellingPrice}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                          errors.sellingPrice ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                    </div>

                    {formData.costPrice && formData.sellingPrice && (
                      <div className="md:col-span-2">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Profit margin:</span>
                            <span className={`font-medium ${calculateProfitMargin() > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {calculateProfitMargin()}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-2">
                            <span className="text-gray-600">Profit per item:</span>
                            <span className="font-medium text-gray-900">
                              ₦{(parseFloat(formData.sellingPrice || 0) - parseFloat(formData.costPrice || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-gray-200 mt-8">
            <button
              type="button"
              onClick={() => router.push('/dashboard/inventory')}
              className="w-full sm:w-auto order-last sm:order-first px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors flex items-center justify-center"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isUploadingImage}
                  className="w-full sm:w-auto px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isSubmitting ? 'Adding...' : 'Add Menu Item'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
