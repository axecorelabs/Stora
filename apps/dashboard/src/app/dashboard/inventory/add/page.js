"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Package, Tag, DollarSign, ChevronLeft, Check } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useInventoryData } from "@/hooks/useInventoryData";
import { compressImageIfNeeded } from "@/lib/imageCompression";
import { CATEGORY_VALUES } from "@stora/shared-constants";

// Import modular components
import ImageUploadSection from "@/components/dashboard/Inventory/ImageUploadSection";
import VariantManager from "@/components/dashboard/Inventory/VariantManager";
import CategoryDetailsRenderer from "@/components/dashboard/Inventory/Categories/CategoryDetailsRenderer";

export default function AddInventoryPage() {
  const router = useRouter();
  const { secureFormDataCall } = useAuth();
  const { addItem, isAddingItem } = useInventoryData();
  const multiImageInputRef = useRef(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    productName: '',
    category: '',
    description: '',
    brand: '',
    unitOfMeasure: 'Piece',
    quantityInStock: '',
    reorderLevel: '',
    costPrice: '',
    sellingPrice: '',
    supplier: '',
    location: 'Main Store',
    qrCode: '',
    notes: '',
    tags: [],
    hasVariants: false,
    variants: [],
    images: []
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [showVariantManager, setShowVariantManager] = useState(false);
  const [tempVariant, setTempVariant] = useState({
    size: '',
    color: '',
    quantityInStock: '',
    reorderLevel: 5,
    images: []
  });
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [detectedColorVariants, setDetectedColorVariants] = useState([]);
  const [variants, setVariants] = useState([]);

  const unitOptions = [
    { value: 'Piece', label: 'Piece' },
    { value: 'Pack', label: 'Pack' },
    { value: 'Carton', label: 'Carton' },
    { value: 'Kg', label: 'Kg' },
    { value: 'Liter', label: 'Liter' },
    { value: 'Meter', label: 'Meter' },
    { value: 'Box', label: 'Box' },
    { value: 'Dozen', label: 'Dozen' },
    { value: 'Other', label: 'Other' }
  ];

  const categoryOptions = [
    ...CATEGORY_VALUES.map((value) => ({ value, label: value })),
    { value: 'Other', label: 'Other' }
  ];

  const tagOptions = [
    { value: 'New arrivals', label: 'New arrivals' },
    { value: 'Best sellers', label: 'Best sellers' },
    { value: 'Limited edition', label: 'Limited edition' },
    { value: 'Summer', label: 'Summer' },
    { value: 'Winter', label: 'Winter' },
    { value: 'Harmattan', label: 'Harmattan' },
    { value: 'Rainy season', label: 'Rainy season' },
    { value: 'Clearance', label: 'Clearance' },
    { value: 'Sale', label: 'Sale' },
    { value: 'Hot deal', label: 'Hot deal' },
    { value: 'Trending', label: 'Trending' },
    { value: 'Featured', label: 'Featured' }
  ];

  // Delivery location handlers for Food/Beverages
  const addDeliveryState = (category) => {
    const key = category === 'Food' ? 'foodDetails' : 'beveragesDetails';
    const currentDetails = formData[key] || {};
    const deliveryLocations = currentDetails.deliveryLocations || {};
    
    if (selectedStateForCity && !deliveryLocations[selectedStateForCity]) {
      setFormData({
        ...formData,
        [key]: {
          ...currentDetails,
          deliveryLocations: {
            ...deliveryLocations,
            [selectedStateForCity]: {
              coverAllCities: false,
              cities: []
            }
          }
        }
      });
      setSelectedStateForCity('');
    }
  };

  const removeDeliveryState = (category, stateName) => {
    const key = category === 'Food' ? 'foodDetails' : 'beveragesDetails';
    const currentDetails = formData[key] || {};
    const deliveryLocations = { ...(currentDetails.deliveryLocations || {}) };
    delete deliveryLocations[stateName];
    
    setFormData({
      ...formData,
      [key]: {
        ...currentDetails,
        deliveryLocations
      }
    });
  };

  const toggleCoverAllCitiesInState = (category, stateName) => {
    const key = category === 'Food' ? 'foodDetails' : 'beveragesDetails';
    const currentDetails = formData[key] || {};
    const deliveryLocations = currentDetails.deliveryLocations || {};
    const stateData = deliveryLocations[stateName] || { coverAllCities: false, cities: [] };
    
    setFormData({
      ...formData,
      [key]: {
        ...currentDetails,
        deliveryLocations: {
          ...deliveryLocations,
          [stateName]: {
            ...stateData,
            coverAllCities: !stateData.coverAllCities
          }
        }
      }
    });
  };

  const addCityToDeliveryState = (category, stateName, city) => {
    const key = category === 'Food' ? 'foodDetails' : 'beveragesDetails';
    const currentDetails = formData[key] || {};
    const deliveryLocations = currentDetails.deliveryLocations || {};
    const stateData = deliveryLocations[stateName] || { coverAllCities: false, cities: [] };
    
    if (!stateData.cities.includes(city)) {
      setFormData({
        ...formData,
        [key]: {
          ...currentDetails,
          deliveryLocations: {
            ...deliveryLocations,
            [stateName]: {
              ...stateData,
              cities: [...stateData.cities, city]
            }
          }
        }
      });
    }
  };

  const removeCityFromDeliveryState = (category, stateName, city) => {
    const key = category === 'Food' ? 'foodDetails' : 'beveragesDetails';
    const currentDetails = formData[key] || {};
    const deliveryLocations = currentDetails.deliveryLocations || {};
    const stateData = deliveryLocations[stateName] || { coverAllCities: false, cities: [] };
    
    setFormData({
      ...formData,
      [key]: {
        ...currentDetails,
        deliveryLocations: {
          ...deliveryLocations,
          [stateName]: {
            ...stateData,
            cities: stateData.cities.filter(c => c !== city)
          }
        }
      }
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle category change - initialize category-specific details
  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, category: value }));
    
    // Initialize category-specific details if not already present
    if (value === 'Clothing' && !formData.clothingDetails) {
      setFormData(prev => ({
        ...prev,
        clothingDetails: {
          sizes: [],
          colors: [],
          materials: []
        }
      }));
    } else if (value === 'Shoes' && !formData.shoesDetails) {
      setFormData(prev => ({
        ...prev,
        shoesDetails: {
          sizes: [],
          colors: [],
          materials: []
        }
      }));
    } else if (value === 'Accessories' && !formData.accessoriesDetails) {
      setFormData(prev => ({
        ...prev,
        accessoriesDetails: {
          types: [],
          colors: [],
          materials: [],
          isNonTarnish: false
        }
      }));
    } else if (value === 'Perfumes' && !formData.perfumesDetails) {
      setFormData(prev => ({
        ...prev,
        perfumesDetails: {
          gender: '',
          scentNotes: [],
          volume: '',
          brand: ''
        }
      }));
    } else if (value === 'Food' && !formData.foodDetails) {
      setFormData(prev => ({
        ...prev,
        foodDetails: {
          foodType: '',
          cuisineType: [],
          servingSize: '',
          ingredients: [],
          allergens: [],
          spiceLevel: '',
          extras: []
        }
      }));
    } else if (value === 'Beverages' && !formData.beveragesDetails) {
      setFormData(prev => ({
        ...prev,
        beveragesDetails: {
          beverageType: '',
          volume: '',
          packaging: '',
          ingredients: [],
          isAlcoholic: false,
          alcoholContent: '',
          isCarbonated: false,
          flavorProfile: []
        }
      }));
    }
    
    // Clear error for category field
    if (errors.category) {
      setErrors(prev => ({ ...prev, category: '' }));
    }
  };

  // Handle category-specific detail changes
  const handleCategoryDetailChange = (category, field, value) => {
    const key = `${category}Details`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }));
  };

  // Handle array field changes (sizes, colors, tags)
  const handleArrayFieldChange = (category, field, value) => {
    const key = `${category}Details`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: [...(prev[key]?.[field] || []), value]
      }
    }));
  };

  const removeArrayItem = (category, field, index) => {
    const key = `${category}Details`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: prev[key]?.[field].filter((_, i) => i !== index) || []
      }
    }));
  };

  // Handle tags
  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.productName?.trim()) {
      newErrors.productName = 'Please tell us what you\'re selling';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please pick what type of thing this is';
    }
    
    if (!formData.quantityInStock || parseFloat(formData.quantityInStock) < 0) {
      newErrors.quantityInStock = 'Please tell us how many you have';
    }
    
    if (!formData.reorderLevel || parseFloat(formData.reorderLevel) < 0) {
      newErrors.reorderLevel = 'Please tell us when to warn you';
    }
    
    if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
      newErrors.costPrice = 'Please tell us how much you paid for it';
    }
    
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
      newErrors.sellingPrice = 'Please tell us how much you\'ll sell it for';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate each step
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.productName?.trim()) {
        newErrors.productName = 'Please tell us what you\'re selling';
      }
      if (!formData.category) {
        newErrors.category = 'Please pick what type of thing this is';
      }
    } else if (step === 3) {
      if (!formData.quantityInStock || parseFloat(formData.quantityInStock) < 0) {
        newErrors.quantityInStock = 'Please tell us how many you have';
      }
      if (!formData.reorderLevel || parseFloat(formData.reorderLevel) < 0) {
        newErrors.reorderLevel = 'Please tell us when to warn you';
      }
      if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
        newErrors.costPrice = 'Please tell us how much you paid for it';
      }
      if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
        newErrors.sellingPrice = 'Please tell us how much you\'ll sell it for';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Handle multiple image upload
  const handleMultiImageSelect = async (e) => {
    const files = Array.from(e.target.files);

    if (selectedImages.length + files.length > 10) {
      setErrors(prev => ({ ...prev, images: 'Maximum 10 images allowed' }));
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const typeValidFiles = files.filter(file => allowedTypes.includes(file.type));
    // Shrinks large source photos client-side before the size check below
    // -- see imageCompression.js.
    const compressedFiles = await Promise.all(typeValidFiles.map(compressImageIfNeeded));
    // Matches lib/r2.js's validateImageFile limit -- see its comment on
    // why 2MB, not 5MB (Vercel's request-body cap is ~4.5MB per request).
    const maxSize = 2 * 1024 * 1024;
    const validFiles = compressedFiles.filter(file => file.size <= maxSize);

    if (validFiles.length !== files.length) {
      setErrors(prev => ({ ...prev, images: 'Some files were invalid (max 2MB, JPEG/PNG/WebP only)' }));
    }

    setSelectedImages(prev => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => {
          const newPreviews = [...prev, {
            url: e.target.result,
            file: file,
            colorTag: '',
            isPrimary: prev.length === 0 && index === 0 // First image is primary
          }];
          return newPreviews;
        });
      };
      reader.readAsDataURL(file);
    });

    setErrors(prev => ({ ...prev, images: '' }));
  };

  const removeMultiImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const updateImageColorTag = (index, color) => {
    setImagePreviews(prev => prev.map((img, i) => 
      i === index ? { ...img, colorTag: color } : img
    ));
  };

  const setPrimaryImage = (index) => {
    setImagePreviews(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index
    })));
  };

  // Toggle variant mode - simplified
  const toggleVariantMode = () => {
    const hasImages = imagePreviews.length > 0;
    const hasVariants = detectedColorVariants.length >= 2;
    
    if (!hasImages || !hasVariants) {
      return;
    }
    
    setShowVariantManager(!showVariantManager);
  };

  // Get available colors from category details
  const getAvailableColors = () => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      return formData.clothingDetails.colors || [];
    } else if (formData.category === 'Shoes' && formData.shoesDetails) {
      return formData.shoesDetails.colors || [];
    } else if (formData.category === 'Accessories' && formData.accessoriesDetails) {
      return formData.accessoriesDetails.colors || [];
    }
    return [];
  };

  // Get available sizes from category details - but don't use it to limit variant manager
  const getAvailableSizes = () => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      return formData.clothingDetails.sizes || [];
    } else if (formData.category === 'Shoes' && formData.shoesDetails) {
      return formData.shoesDetails.sizes || [];
    }
    return [];
  };

  // Function to sync sizes from variant manager to category details
  // This is one-way: variants → category details (not the reverse)
  const syncSizesToCategory = (sizes) => {
    if (formData.category === 'Clothing') {
      setFormData(prev => ({
        ...prev,
        clothingDetails: {
          ...(prev.clothingDetails || {}),
          sizes: sizes
        }
      }));
    } else if (formData.category === 'Shoes') {
      setFormData(prev => ({
        ...prev,
        shoesDetails: {
          ...(prev.shoesDetails || {}),
          sizes: sizes
        }
      }));
    }
  };

  // Check for duplicate variant
  const isDuplicateVariant = (size, color, excludeIndex = null) => {
    return variants.some((v, index) => 
      index !== excludeIndex && 
      v.size === size && 
      v.color === color
    );
  };

  // Add or update variant
  const handleSaveVariant = () => {
    // Validate variant
    if (!tempVariant.size?.trim()) {
      alert('Please enter a size');
      return;
    }
    if (!tempVariant.color?.trim()) {
      alert('Please select a color');
      return;
    }
    if (!tempVariant.quantityInStock || parseFloat(tempVariant.quantityInStock) < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    // Check for duplicates (only when adding new or editing with different values)
    if (isDuplicateVariant(tempVariant.size, tempVariant.color, editingVariantIndex)) {
      alert(`A variant with size "${tempVariant.size}" and color "${tempVariant.color}" already exists`);
      return;
    }

    if (editingVariantIndex !== null) {
      // Update existing variant
      setVariants(prev => prev.map((v, i) => 
        i === editingVariantIndex ? { ...tempVariant } : v
      ));
      setEditingVariantIndex(null);
    } else {
      // Add new variant
      setVariants(prev => [...prev, { ...tempVariant }]);
    }

    // Reset temp variant
    setTempVariant({
      size: '',
      color: '',
      quantityInStock: '',
      reorderLevel: 5,
      images: []
    });

    // Sync sizes to category details
    const allSizes = [...new Set([...variants.map(v => v.size), tempVariant.size])];
    syncSizesToCategory(allSizes);
  };

  const editVariant = (index) => {
    setTempVariant(variants[index]);
    setEditingVariantIndex(index);
  };

  const deleteVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
    
    // Update sizes in category details
    const remainingVariants = variants.filter((_, i) => i !== index);
    const allSizes = [...new Set(remainingVariants.map(v => v.size))];
    syncSizesToCategory(allSizes);
  };

  const handleVariantsDetected = (colors) => {
    setDetectedColorVariants(colors);
    // Automatically sync colors to category details
    if (formData.category === 'Clothing') {
      setFormData(prev => ({
        ...prev,
        clothingDetails: {
          ...(prev.clothingDetails || {}),
          colors: colors
        }
      }));
    } else if (formData.category === 'Shoes') {
      setFormData(prev => ({
        ...prev,
        shoesDetails: {
          ...(prev.shoesDetails || {}),
          colors: colors
        }
      }));
    } else if (formData.category === 'Accessories') {
      setFormData(prev => ({
        ...prev,
        accessoriesDetails: {
          ...(prev.accessoriesDetails || {}),
          colors: colors
        }
      }));
    }
  };

  // Calculate total stock from variants - Make this more robust
  const calculateTotalStock = () => {
    if (variants.length === 0) {
      return 0;
    }
    
    const total = variants.reduce((sum, variant) => {
      const qty = parseFloat(variant.quantityInStock) || 0;
      return sum + qty;
    }, 0);
    
    return total;
  };

  // Function to sync total stock from variant manager to stock field
  const syncStockToForm = () => {
    if (variants.length === 0) {
      return;
    }
    
    const totalStock = calculateTotalStock();
    
    setFormData(prev => ({
      ...prev,
      quantityInStock: totalStock.toString(),
      hasVariants: true,
      variants: variants
    }));
  };

  // Add useEffect to sync whenever variants change
  useEffect(() => {
    if (detectedColorVariants.length >= 2 && variants.length > 0) {
      syncStockToForm();
    } else if (detectedColorVariants.length < 2) {
      // Reset variant mode if colors are removed
      setFormData(prev => ({
        ...prev,
        hasVariants: false,
        variants: []
      }));
    }
  }, [variants, detectedColorVariants.length]);

  // Upload multiple images
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
            colorTag: preview.colorTag || '',
            isPrimary: preview.isPrimary || false
          });
        }
      }
      return uploadedImages;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Upload images first
      const uploadedImages = await uploadMultipleImages();

      // Prepare the payload
      const payload = {
        ...formData,
        images: uploadedImages,
        quantityInStock: parseFloat(formData.quantityInStock),
        reorderLevel: parseFloat(formData.reorderLevel),
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
      };

      // If has variants, include them
      if (detectedColorVariants.length >= 2 && variants.length > 0) {
        payload.hasVariants = true;
        payload.variants = variants.map(v => ({
          ...v,
          quantityInStock: parseFloat(v.quantityInStock),
          reorderLevel: parseFloat(v.reorderLevel)
        }));
      }

      // Submit to API
      await addItem(payload);
      
      // Navigate back to inventory page on success
      router.push('/dashboard/inventory');
    } catch (error) {
      console.error('Error adding item:', error);
      setErrors({ submit: error.message || 'Failed to add product. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    if (cost === 0) return 0;
    return (((selling - cost) / cost) * 100).toFixed(2);
  };

  // Function to add color to category details
  const addColorToCategory = (colorName) => {
    const trimmedColor = colorName.trim();
    if (!trimmedColor) return;
    
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      if (!formData.clothingDetails.colors.includes(trimmedColor)) {
        handleArrayFieldChange('clothing', 'colors', trimmedColor);
      }
    } else if (formData.category === 'Shoes' && formData.shoesDetails) {
      if (!formData.shoesDetails.colors.includes(trimmedColor)) {
        handleArrayFieldChange('shoes', 'colors', trimmedColor);
      }
    } else if (formData.category === 'Accessories' && formData.accessoriesDetails) {
      if (!formData.accessoriesDetails.colors.includes(trimmedColor)) {
        handleArrayFieldChange('accessories', 'colors', trimmedColor);
      }
    }
  };

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Product details' },
    { number: 2, title: 'Images & Variants', description: 'Photos & options' },
    { number: 3, title: 'Stock & Pricing', description: 'Inventory & money' },
    { number: 4, title: 'Additional Details', description: 'Extra info' }
  ];

  return (
    <DashboardLayout>
      {/* Breadcrumb Navigation */}
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => router.push('/dashboard/inventory')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            Inventory
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Add New Product</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white rounded-2xl pb-4 lg:pb-6 mb-4 lg:mb-6">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-100 rounded-xl">
              <Package className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Add New Product</h2>
              <p className="text-sm text-gray-500">Step {currentStep} of 4: {steps[currentStep - 1].title}</p>
            </div>
          </div>
        </div>

        {/* Progress Steps -- two different layouts, not one conditionally-
            shrunk one. Below lg: a compact row of numbered dots and a
            connector line only, no per-step text: every label except
            "Basic Info" wrapped across 2-3 lines at phone widths, which
            blew up this header's height and made the connector lines
            nearly invisible against all that wrapped text. The "Step X of
            4: <title>" line above already names the current step, so
            nothing is lost by dropping the labels here. At lg: and up,
            the original full circle + title + description per step is
            unchanged. */}
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
                  <div className={`h-0.5 flex-1 mx-1.5 ${
                    currentStep > step.number ? 'bg-brand-800' : 'bg-gray-200'
                  }`} />
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
                    <p className={`text-sm font-medium ${
                      currentStep === step.number ? 'text-brand-800' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-8 ${
                    currentStep > step.number ? 'bg-brand-800' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <form onSubmit={(e) => {
          e.preventDefault();
        }} onKeyDown={(e) => {
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
            {/* STEP 1: Product Information Section */}
            {currentStep === 1 && (
            <>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-gray-600" />
                What are you selling?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">What do you call this thing you're selling?</p>
                  <input
                    type="text"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    placeholder="e.g., Red T-Shirt, iPhone 13, Bread"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                      errors.productName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.productName && (
                    <p className="text-red-500 text-xs mt-1">{errors.productName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">What type of thing is this?</p>
                  <CustomDropdown
                    options={categoryOptions}
                    value={formData.category}
                    onChange={handleCategoryChange}
                    placeholder="Pick what type it is"
                    error={!!errors.category}
                  />
                  {errors.category && (
                    <p className="text-red-500 text-xs mt-1">{errors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Who made this? Like Nike makes shoes, Apple makes phones</p>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g., Nike, Samsung, Coca-Cola"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Tell us more about it - what color, size, or special things about it</p>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="e.g., Blue color, size Large, very soft"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>

            {/* Category Details - Now Modular */}
            <CategoryDetailsRenderer
              category={formData.category}
              formData={formData}
              handleCategoryDetailChange={handleCategoryDetailChange}
              handleArrayFieldChange={handleArrayFieldChange}
              removeArrayItem={removeArrayItem}
              detectedColorVariants={detectedColorVariants}
            />
            </>
            )}

            {/* STEP 2: Images & Variants */}
            {currentStep === 2 && (
            <>
            {/* Image Upload Section - Now Modular */}
            <ImageUploadSection
              hasVariants={formData.hasVariants}
              category={formData.category}
              imagePreviews={imagePreviews}
              multiImageInputRef={multiImageInputRef}
              handleMultiImageSelect={handleMultiImageSelect}
              removeMultiImage={removeMultiImage}
              updateImageColorTag={updateImageColorTag}
              setPrimaryImage={setPrimaryImage}
              getAvailableColors={getAvailableColors}
              addColorToCategory={addColorToCategory}
              onVariantsDetected={handleVariantsDetected}
              errors={errors}
            />

            {/* Variant Manager - Auto-shown when variants detected */}
            {detectedColorVariants.length >= 2 && (
              <VariantManager
                category={formData.category} // Pass category for size input type
                detectedColors={detectedColorVariants}
                variants={variants}
                setVariants={setVariants}
                getAvailableSizes={getAvailableSizes}
                calculateTotalStock={calculateTotalStock}
                syncSizesToCategory={syncSizesToCategory}
                syncStockToForm={syncStockToForm}
              />
            )}
            </>
            )}

            {/* STEP 3: Stock & Pricing */}
            {currentStep === 3 && (
            <>
            {/* Stock Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-gray-600" />
                {formData.category === 'Food' ? 'How much do you plan to sell?' : 'How many do you have?'}
              </h3>
              
              {formData.category === 'Food' && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    💡 <strong>Note:</strong> For food items, use this to set targets for how much you want to sell this week or month. 
                    This helps you plan your production and ingredients better!
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How do you count this? *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {formData.category === 'Food' 
                      ? 'How do you package or serve this?' 
                      : 'Do you count by pieces (1, 2, 3) or by weight (1kg, 2kg)?'
                    }
                  </p>
                  <CustomDropdown
                    options={
                      formData.category === 'Food'
                        ? [
                            { value: 'Plate (Takeaway)', label: 'Plate (Takeaway)' },
                            { value: 'Pack', label: 'Pack' },
                            { value: 'Bowl', label: 'Bowl' },
                            { value: 'Wrap', label: 'Wrap' },
                            { value: 'Kg', label: 'Kg' },
                            { value: 'Liter', label: 'Liter' },
                            { value: 'Box', label: 'Box' },
                            { value: 'Dozen', label: 'Dozen' },
                            { value: 'Other', label: 'Other' }
                        ]
                        : unitOptions
                    }
                    value={formData.unitOfMeasure}
                    onChange={(value) => handleChange({ target: { name: 'unitOfMeasure', value } })}
                    placeholder="How do you count?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.category === 'Food' 
                      ? 'How many do you plan to sell? *' 
                      : 'How many do you have right now? *'
                    }
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {formData.category === 'Food'
                      ? 'Your sales target (you can update this anytime)'
                      : detectedColorVariants.length >= 2
                      ? 'Total stock calculated from your variants above'
                      : 'Count how many you have in your shop or store right now'
                    }
                  </p>
                  <input
                    type="number"
                    name="quantityInStock"
                    value={formData.quantityInStock}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={detectedColorVariants.length >= 2}
                    readOnly={detectedColorVariants.length >= 2}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                      errors.quantityInStock ? 'border-red-300' : 'border-gray-300'
                    } ${detectedColorVariants.length >= 2 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {detectedColorVariants.length >= 2 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-blue-600">
                        ℹ️ Auto-calculated from {variants.length} color variant(s)
                      </p>
                      <p className="text-xs text-gray-500">
                        Current total: <span className="font-semibold text-gray-900">{formData.quantityInStock || '0'}</span> units
                      </p>
                    </div>
                  )}
                  {errors.quantityInStock && (
                    <p className="text-red-500 text-xs mt-1">{errors.quantityInStock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    When should we warn you? *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {formData.category === 'Food'
                      ? 'Alert me when I reach this many sales'
                      : 'When you have this many left, we\'ll tell you to buy more'
                    }
                  </p>
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
                  {errors.reorderLevel && (
                    <p className="text-red-500 text-xs mt-1">{errors.reorderLevel}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
                Money stuff
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.category === 'Food' || formData.category === 'Beverages' 
                      ? 'How much does it cost you to make one? *' 
                      : 'How much did you pay for it? *'
                    }
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {formData.category === 'Food' || formData.category === 'Beverages'
                      ? 'Calculate ingredients + cooking/production + packaging costs per item'
                      : 'How much money did you give to buy this from someone else?'
                    }
                  </p>
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
                  {errors.costPrice && (
                    <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>
                  )}
                  {(formData.category === 'Food' || formData.category === 'Beverages') && (
                    <p className="text-xs text-amber-600 mt-1">
                      💡 <strong>Important:</strong> Accurate production cost helps calculate real profit margins!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How much will you sell it for? *
                  </label>
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
                  {errors.sellingPrice && (
                    <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>
                  )}
                </div>

                {/* Profit Margin Display */}
                {formData.costPrice && formData.sellingPrice && (
                  <div className="md:col-span-2">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">How much extra money you make:</span>
                        <span className={`font-medium ${
                          calculateProfitMargin() > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {calculateProfitMargin()}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-gray-600">Extra money from each one:</span>
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

            {/* STEP 4: Additional Information & Tags */}
            {currentStep === 4 && (
            <>
            {/* Tags Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Tags (optional)
              </h3>
              <p className="text-sm text-gray-500 mb-3">Help customers find your product easier</p>
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

            {/* Additional Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Extra information (you can skip these)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Where do you buy this from?
                  </label>
                  <p className="text-xs text-gray-500 mb-2">The person or shop you buy this from</p>
                  <input
                    type="text"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleChange}
                    placeholder="e.g., John's Shop, Market Mama"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Where do you keep this?
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Which part of your shop or room do you put this?</p>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g., Front shelf, Back room, Counter"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    QR Code
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Square code you can scan with your phone camera</p>
                  <input
                    type="text"
                    name="qrCode"
                    value={formData.qrCode}
                    onChange={handleChange}
                    placeholder="e.g., QR12345ABC"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes to remember
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Write anything you want to remember about this</p>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="e.g., People love this, Buy more next week"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-8">
            <button
              type="button"
              onClick={() => router.push('/dashboard/inventory')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            <div className="flex items-center space-x-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
              )}
              
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors flex items-center"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isUploadingImage}
                  className="px-6 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {isSubmitting || isUploadingImage ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isUploadingImage ? 'Uploading Image...' : 'Adding Product...'}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Add Product
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
