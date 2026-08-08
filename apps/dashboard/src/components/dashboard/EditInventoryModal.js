"use client";
import { useState, useRef, useEffect } from "react";
import { X, Package, Tag, DollarSign } from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";

// Import modular components
import ImageUploadSection from "./Inventory/ImageUploadSection";
import VariantManager from "./Inventory/VariantManager";
import CategoryDetailsRenderer from "./Inventory/Categories/CategoryDetailsRenderer";

export default function EditInventoryModal({ isOpen, onClose, onSubmit, item }) {
  const { secureFormDataCall, secureApiCall } = useAuth();
  const multiImageInputRef = useRef(null);
  
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
    images: [],
    clothingDetails: null,
    shoesDetails: null,
    accessoriesDetails: null,
    perfumeDetails: null,
    foodDetails: null,
    beveragesDetails: null,
    electronicsDetails: null,
    booksDetails: null,
    homeGardenDetails: null,
    sportsDetails: null,
    automotiveDetails: null,
    healthBeautyDetails: null
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [detectedColorVariants, setDetectedColorVariants] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedStateForCity, setSelectedStateForCity] = useState('');
  
  // Batch tracking state - current active batch (FIFO)
  const [activeBatch, setActiveBatch] = useState(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [batchUpdated, setBatchUpdated] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('basic');

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
    { value: 'Clothing', label: 'Clothing' },
    { value: 'Shoes', label: 'Shoes' },
    { value: 'Accessories', label: 'Accessories' },
    { value: 'Perfumes', label: 'Perfumes' },
    { value: 'Food', label: 'Food' },
    { value: 'Beverages', label: 'Beverages' },
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Books', label: 'Books' },
    { value: 'Home & Garden', label: 'Home & Garden' },
    { value: 'Sports', label: 'Sports' },
    { value: 'Automotive', label: 'Automotive' },
    { value: 'Health & Beauty', label: 'Health & Beauty' },
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

  const NIGERIAN_STATES = {
    'Lagos': ['Ikeja', 'Lagos Island', 'Lekki', 'Ikorodu', 'Epe', 'Badagry', 'Victoria Island', 'Yaba', 'Surulere', 'Ajah'],
    'Abuja': ['Central Area', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Kubwa', 'Lugbe'],
    'Oyo': ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin'],
    'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota'],
    'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme'],
    'Kano': ['Kano', 'Wudil', 'Bichi', 'Gwarzo'],
  };

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Fetch current active batch for the item (FIFO - oldest active batch with stock)
  const fetchActiveBatch = async (productId) => {
    setIsLoadingBatch(true);
    try {
      const response = await secureApiCall(`/api/inventory/${productId}/batches?active=true`);
      if (response.success && response.batches && response.batches.length > 0) {
        setActiveBatch(response.batches[0]);
      } else {
        setActiveBatch(null);
      }
    } catch (error) {
      console.error('Failed to fetch active batch:', error);
      setActiveBatch(null);
    } finally {
      setIsLoadingBatch(false);
    }
  };

  // Populate form when item changes
  useEffect(() => {
    if (item && isOpen) {
      // Transform existing variants to new format
      const transformedVariants = transformExistingVariants(item.variants || []);
      
      setFormData({
        productName: item.productName || '',
        category: item.category || '',
        description: item.description || '',
        brand: item.brand || '',
        unitOfMeasure: item.unitOfMeasure || 'Piece',
        quantityInStock: item.quantityInStock?.toString() || '',
        reorderLevel: item.reorderLevel?.toString() || '',
        costPrice: item.costPrice?.toString() || '',
        sellingPrice: item.sellingPrice?.toString() || '',
        supplier: item.supplier || '',
        location: item.location || 'Main Store',
        qrCode: item.qrCode || '',
        notes: item.notes || '',
        tags: item.tags || [],
        hasVariants: item.hasVariants || false,
        variants: item.variants || [],
        images: item.images || [],
        clothingDetails: item.clothingDetails || null,
        shoesDetails: item.shoesDetails || null,
        accessoriesDetails: item.accessoriesDetails || null,
        perfumeDetails: item.perfumeDetails || null,
        foodDetails: item.foodDetails || null,
        beveragesDetails: item.beveragesDetails || null,
        electronicsDetails: item.electronicsDetails || null,
        booksDetails: item.booksDetails || null,
        homeGardenDetails: item.homeGardenDetails || null,
        sportsDetails: item.sportsDetails || null,
        automotiveDetails: item.automotiveDetails || null,
        healthBeautyDetails: item.healthBeautyDetails || null
      });
      
      // Set existing images
      const existingImgs = (item.images || []).map(img => ({
        url: typeof img === 'string' ? img : img.url,
        colorTag: typeof img === 'object' ? img.colorTag : '',
        isPrimary: typeof img === 'object' ? img.isPrimary : false,
        existing: true
      }));
      setExistingImages(existingImgs);
      setImagePreviews(existingImgs);
      
      // Set variants in new format
      setVariants(transformedVariants);
      
      // Detect color variants
      const colors = transformedVariants.map(v => v.color);
      setDetectedColorVariants(colors);
      
      setSelectedImages([]);
      setErrors({});
      
      // Fetch current active batch (FIFO)
      fetchActiveBatch(item._id);
    }
  }, [item, isOpen]);

  // Transform existing variants from database format to UI format
  const transformExistingVariants = (dbVariants) => {
    if (!dbVariants || dbVariants.length === 0) return [];
    
    // Group variants by color
    const colorGroups = dbVariants.reduce((groups, variant) => {
      const color = variant.color;
      if (!groups[color]) {
        groups[color] = {
          color: color,
          sizes: []
        };
      }
      
      groups[color].sizes.push({
        size: variant.size,
        quantityInStock: variant.quantityInStock || 0,
        reorderLevel: variant.reorderLevel || 5,
        sku: variant.sku || ''
      });
      
      return groups;
    }, {});
    
    return Object.values(colorGroups);
  };

  // Delivery location handlers (same as AddInventoryModal)
  const addDeliveryState = (category) => {
    if (!selectedStateForCity) return;
    
    const stateExists = formData[`${category}Details`]?.deliveryLocations.states.some(
      s => s.stateName === selectedStateForCity
    );
    
    if (stateExists) {
      alert('This state is already added');
      return;
    }

    handleCategoryDetailChange(category, 'deliveryLocations', {
      ...formData[`${category}Details`].deliveryLocations,
      states: [
        ...formData[`${category}Details`].deliveryLocations.states,
        {
          stateName: selectedStateForCity,
          cities: [],
          coverAllCities: false
        }
      ]
    });
    setSelectedStateForCity('');
  };

  const removeDeliveryState = (category, stateName) => {
    handleCategoryDetailChange(category, 'deliveryLocations', {
      ...formData[`${category}Details`].deliveryLocations,
      states: formData[`${category}Details`].deliveryLocations.states.filter(s => s.stateName !== stateName)
    });
  };

  const toggleCoverAllCitiesInState = (category, stateName) => {
    const updatedStates = formData[`${category}Details`].deliveryLocations.states.map(state => 
      state.stateName === stateName
        ? { ...state, coverAllCities: !state.coverAllCities, cities: [] }
        : state
    );
    
    handleCategoryDetailChange(category, 'deliveryLocations', {
      ...formData[`${category}Details`].deliveryLocations,
      states: updatedStates
    });
  };

  const addCityToDeliveryState = (category, stateName, city) => {
    const updatedStates = formData[`${category}Details`].deliveryLocations.states.map(state => 
      state.stateName === stateName
        ? {
            ...state,
            cities: state.cities.includes(city)
              ? state.cities
              : [...state.cities, city]
          }
        : state
    );
    
    handleCategoryDetailChange(category, 'deliveryLocations', {
      ...formData[`${category}Details`].deliveryLocations,
      states: updatedStates
    });
  };

  const removeCityFromDeliveryState = (category, stateName, city) => {
    const updatedStates = formData[`${category}Details`].deliveryLocations.states.map(state => 
      state.stateName === stateName
        ? { ...state, cities: state.cities.filter(c => c !== city) }
        : state
    );
    
    handleCategoryDetailChange(category, 'deliveryLocations', {
      ...formData[`${category}Details`].deliveryLocations,
      states: updatedStates
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle category change - DON'T initialize if data already exists
  const handleCategoryChange = (value) => {
    handleChange({ target: { name: 'category', value } });
  };

  // Handle category-specific detail changes
  const handleCategoryDetailChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [`${category}Details`]: {
        ...prev[`${category}Details`],
        [field]: value
      }
    }));
  };

  // Handle array field changes (sizes, colors, tags)
  const handleArrayFieldChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [`${category}Details`]: {
        ...prev[`${category}Details`],
        [field]: [...(prev[`${category}Details`]?.[field] || []), value]
      }
    }));
  };

  const removeArrayItem = (category, field, index) => {
    setFormData(prev => ({
      ...prev,
      [`${category}Details`]: {
        ...prev[`${category}Details`],
        [field]: prev[`${category}Details`][field].filter((_, i) => i !== index)
      }
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

  // Image handling
  const handleMultiImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (imagePreviews.length + files.length > 10) {
      setErrors(prev => ({ ...prev, images: 'Maximum 10 images allowed' }));
      return;
    }

    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024;
      return allowedTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== files.length) {
      setErrors(prev => ({ ...prev, images: 'Some files were invalid (max 5MB, JPEG/PNG/WebP only)' }));
    }

    setSelectedImages(prev => [...prev, ...validFiles]);

    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => {
          const existingCount = prev.filter(p => p.existing).length;
          const newPreviews = [...prev, {
            url: e.target.result,
            file: file,
            colorTag: '',
            isPrimary: prev.length === 0 && index === 0,
            existing: false
          }];
          return newPreviews;
        });
      };
      reader.readAsDataURL(file);
    });

    setErrors(prev => ({ ...prev, images: '' }));
  };

  const removeMultiImage = (index) => {
    const imageToRemove = imagePreviews[index];
    
    if (imageToRemove.existing) {
      // Remove from existing images
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      // Remove from new images
      const newImageIndex = imagePreviews.slice(0, index).filter(img => !img.existing).length;
      setSelectedImages(prev => prev.filter((_, i) => i !== newImageIndex));
    }
    
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

  const getAvailableColors = () => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      return formData.clothingDetails.colors || [];
    }
    if (formData.category === 'Shoes' && formData.shoesDetails) {
      return formData.shoesDetails.colors || [];
    }
    if (formData.category === 'Accessories' && formData.accessoriesDetails) {
      return formData.accessoriesDetails.colors || [];
    }
    return [];
  };

  const getAvailableSizes = () => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      return formData.clothingDetails.sizes || [];
    }
    if (formData.category === 'Shoes' && formData.shoesDetails) {
      return formData.shoesDetails.sizes || [];
    }
    return [];
  };

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

  const handleVariantsDetected = (colors) => {
    setDetectedColorVariants(colors);
    setFormData(prev => ({
      ...prev,
      hasVariants: colors.length >= 2
    }));
  };

  const syncSizesToCategory = (sizes) => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      setFormData(prev => ({
        ...prev,
        clothingDetails: {
          ...prev.clothingDetails,
          sizes: sizes
        }
      }));
    } else if (formData.category === 'Shoes' && formData.shoesDetails) {
      setFormData(prev => ({
        ...prev,
        shoesDetails: {
          ...prev.shoesDetails,
          sizes: sizes
        }
      }));
    }
  };

  const calculateTotalStock = () => {
    if (!variants || variants.length === 0) return 0;
    
    return variants.reduce((total, variant) => {
      if (!variant.sizes || !Array.isArray(variant.sizes)) return total;
      return total + variant.sizes.reduce((sum, size) => {
        return sum + (parseInt(size.quantityInStock) || 0);
      }, 0);
    }, 0);
  };

  const syncStockToForm = () => {
    const totalStock = calculateTotalStock();
    setFormData(prev => ({
      ...prev,
      quantityInStock: totalStock.toString()
    }));
    
    if (errors.quantityInStock) {
      setErrors(prev => ({ ...prev, quantityInStock: '' }));
    }
  };

  useEffect(() => {
    if (detectedColorVariants.length >= 2 && variants && variants.length > 0) {
      const totalStock = calculateTotalStock();
      setFormData(prev => ({
        ...prev,
        quantityInStock: totalStock.toString()
      }));
    }
  }, [variants, detectedColorVariants.length]);

  const uploadMultipleImages = async () => {
    if (selectedImages.length === 0) return [];

    setIsUploadingImage(true);
    const uploadedUrls = [];

    try {
      for (const file of selectedImages) {
        const imageFormData = new FormData();
        imageFormData.append('image', file);
        const result = await secureFormDataCall('/api/inventory/upload-image', imageFormData);
        uploadedUrls.push(result.imageUrl);
      }
      return uploadedUrls;
    } catch (error) {
      setErrors(prev => ({ ...prev, images: 'Failed to upload some images' }));
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    if (detectedColorVariants.length < 2) {
      if (!formData.quantityInStock || formData.quantityInStock < 0) {
        newErrors.quantityInStock = 'Valid quantity is required';
      }
    }

    if (!formData.reorderLevel || formData.reorderLevel < 0) {
      newErrors.reorderLevel = 'Valid reorder level is required';
    }

    if (!formData.costPrice || formData.costPrice <= 0) {
      newErrors.costPrice = 'Valid cost price is required';
    }

    if (!formData.sellingPrice || formData.sellingPrice <= 0) {
      newErrors.sellingPrice = 'Valid selling price is required';
    }

    if (parseFloat(formData.sellingPrice) < parseFloat(formData.costPrice)) {
      newErrors.sellingPrice = 'Selling price should be higher than cost price';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (detectedColorVariants.length >= 2) {
      const totalStock = calculateTotalStock();
      setFormData(prev => ({
        ...prev,
        quantityInStock: totalStock.toString()
      }));
    }
    
    if (!validateForm()) return;

    if (imagePreviews.length === 0) {
      setErrors({ submit: 'Please upload at least one product image' });
      return;
    }

    if (detectedColorVariants.length >= 2) {
      if (variants.length === 0 || variants.every(v => v.sizes.length === 0)) {
        setErrors({ submit: 'Please configure sizes and stock for your color variants' });
        return;
      }
      
      const totalStock = calculateTotalStock();
      if (totalStock === 0) {
        setErrors({ submit: 'Please add stock quantities to your variants' });
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      // Upload new images
      const uploadedUrls = await uploadMultipleImages();
      
      // Combine existing and new images
      const existingImagesData = imagePreviews
        .filter(img => img.existing)
        .map(img => ({
          url: img.url,
          colorTag: img.colorTag,
          isPrimary: img.isPrimary,
          altText: `${formData.productName} - ${img.colorTag || 'Image'}`
        }));
      
      const newImagesData = imagePreviews
        .filter(img => !img.existing)
        .map((preview, index) => ({
          url: uploadedUrls[index],
          colorTag: preview.colorTag,
          isPrimary: preview.isPrimary,
          altText: `${formData.productName} - ${preview.colorTag || 'Image'}`
        }));
      
      const allImagesData = [...existingImagesData, ...newImagesData];
      const imageUrl = allImagesData.find(img => img.isPrimary)?.url || allImagesData[0]?.url;

      // Transform variants
      const transformedVariants = variants.flatMap(colorVariant =>
        colorVariant.sizes.map(sizeObj => ({
          size: sizeObj.size,
          color: colorVariant.color,
          quantityInStock: parseInt(sizeObj.quantityInStock) || 0,
          reorderLevel: sizeObj.reorderLevel || 5,
          soldQuantity: 0,
          images: imagePreviews
            .filter(img => img.colorTag === colorVariant.color)
            .map(img => img.existing ? img.url : uploadedUrls[imagePreviews.filter(p => !p.existing).indexOf(img)]),
          sku: sizeObj.sku || `${formData.category.substring(0, 3).toUpperCase()}-${colorVariant.color.substring(0, 3).toUpperCase()}-${sizeObj.size}`,
          isActive: true
        }))
      );

      const finalTotalStock = detectedColorVariants.length >= 2 
        ? calculateTotalStock() 
        : parseFloat(formData.quantityInStock);

      const processedData = {
        ...formData,
        quantityInStock: finalTotalStock,
        reorderLevel: parseFloat(formData.reorderLevel),
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        image: imageUrl,
        images: allImagesData,
        hasVariants: detectedColorVariants.length >= 2,
        variants: transformedVariants
      };

      const response = await onSubmit(item._id, processedData);
      
      if (response && response.success) {
        // Update current active batch with all relevant fields that changed
        if (activeBatch) {
          const batchUpdates = {};
          let hasChanges = false;

          // Check and prepare all fields that should sync to active batch
          if (parseFloat(formData.costPrice) !== activeBatch.costPrice) {
            batchUpdates.costPrice = parseFloat(formData.costPrice);
            hasChanges = true;
          }
          
          if (parseFloat(formData.sellingPrice) !== activeBatch.sellingPrice) {
            batchUpdates.sellingPrice = parseFloat(formData.sellingPrice);
            hasChanges = true;
          }
          
          if (formData.supplier && formData.supplier !== activeBatch.supplier) {
            batchUpdates.supplier = formData.supplier;
            hasChanges = true;
          }
          
          if (formData.location && formData.location !== activeBatch.batchLocation) {
            batchUpdates.batchLocation = formData.location;
            hasChanges = true;
          }

          // Only make API call if there are actual changes
          if (hasChanges) {
            try {
              const batchData = JSON.stringify({
                batchId: activeBatch._id,
                ...batchUpdates
              });

              const batchUpdateResponse = await secureApiCall(
                `/api/inventory/${item._id}/batches`,
                {
                  method: 'PATCH',
                  body: batchData
                }
              );

              if (batchUpdateResponse.success) {
                console.log('Active batch updated successfully with:', Object.keys(batchUpdates).join(', '));
                setBatchUpdated(true);
              }
            } catch (batchError) {
              console.error('Failed to update active batch:', batchError);
              // Don't fail the entire operation if batch update fails
            }
          }
        }
        
        setSelectedImages([]);
        setImagePreviews([]);
        setExistingImages([]);
        setDetectedColorVariants([]);
        setVariants([]);
        setErrors({});
        setActiveBatch(null);
        setBatchUpdated(false);
        setIsSubmitting(false);
        onClose();
      } else {
        throw new Error(response?.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setErrors({ submit: error.message || 'Failed to update item' });
      setIsSubmitting(false);
    }
  };

  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    if (cost === 0) return 0;
    return (((selling - cost) / cost) * 100).toFixed(1);
  };

  if (!isOpen || !item) return null;

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'media', label: 'Images & Variants', icon: Tag },
    { id: 'stock', label: 'Stock & Pricing', icon: DollarSign },
    ...(formData.category && formData.category !== 'Other' 
      ? [{ id: 'category', label: `${formData.category} Details`, icon: Package }] 
      : []),
    { id: 'additional', label: 'Additional Info', icon: Tag }
  ];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Package className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Product</h2>
              <p className="text-sm text-gray-500">Update {item.productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-teal-600 text-teal-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form id="edit-inventory-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-8">
              {/* Product Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-gray-600" />
                  Product Information
                </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    placeholder="e.g., Red T-Shirt"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.productName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <CustomDropdown
                    options={categoryOptions}
                    value={formData.category}
                    onChange={handleCategoryChange}
                    placeholder="Select category"
                    error={!!errors.category}
                  />
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g., Nike"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Describe your product"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                  />
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Images & Variants Tab */}
          {activeTab === 'media' && (
            <div className="space-y-8">
              {/* Image Upload Section */}
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

            {/* Variant Manager */}
            {detectedColorVariants.length >= 2 && (
              <VariantManager
                detectedColors={detectedColorVariants}
                variants={variants}
                setVariants={setVariants}
                getAvailableSizes={getAvailableSizes}
                calculateTotalStock={calculateTotalStock}
                syncSizesToCategory={syncSizesToCategory}
                syncStockToForm={syncStockToForm}
              />
            )}
            </div>
          )}

          {/* Stock & Pricing Tab */}
          {activeTab === 'stock' && (
            <div className="space-y-8">
              {/* Stock Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-gray-600" />
                Stock Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit of Measure *
                  </label>
                  <CustomDropdown
                    options={unitOptions}
                    value={formData.unitOfMeasure}
                    onChange={(value) => handleChange({ target: { name: 'unitOfMeasure', value } })}
                    placeholder="Select unit"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity in Stock *
                    {detectedColorVariants.length >= 2 && (
                      <span className="text-xs text-blue-600 ml-2">(Auto-calculated from variants)</span>
                    )}
                  </label>
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.quantityInStock ? 'border-red-300' : 'border-gray-300'
                    } ${detectedColorVariants.length >= 2 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                  {detectedColorVariants.length >= 2 && (
                    <p className="text-xs text-blue-600 mt-1">
                      ✓ Auto-calculated from variants: {formData.quantityInStock} units
                    </p>
                  )}
                  {!detectedColorVariants.length >= 2 && errors.quantityInStock && (
                    <p className="text-red-500 text-xs mt-1">{errors.quantityInStock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Level *
                  </label>
                  <input
                    type="number"
                    name="reorderLevel"
                    value={formData.reorderLevel}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    placeholder="5"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.reorderLevel ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.reorderLevel && (
                    <p className="text-red-500 text-xs mt-1">{errors.reorderLevel}</p>
                  )}
                </div>
              </div>

              {/* Stock Information Help Text for Variants */}
              {detectedColorVariants.length >= 2 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start space-x-2">
                    <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Variant Stock Management</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Total stock quantity is automatically calculated from all your variants. 
                        Manage individual variant quantities in the Variant Manager above.
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        <span className="font-medium">Current breakdown:</span>
                        {variants.map((variant, idx) => (
                          <div key={idx} className="ml-2 mt-1">
                            • {variant.color}: {variant.sizes.reduce((sum, s) => sum + (parseInt(s.quantityInStock) || 0), 0)} units
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
                Pricing
              </h3>
              
              {/* Current Active Batch Info */}
              {activeBatch && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start space-x-2">
                    <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Current Active Batch: {activeBatch.batchCode}</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Received: {new Date(activeBatch.dateReceived).toLocaleDateString()} • 
                        Remaining: {activeBatch.quantityRemaining} {formData.unitOfMeasure}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-blue-600">Batch Cost:</span>
                          <span className="ml-1 font-medium text-blue-900">₦{activeBatch.costPrice}</span>
                        </div>
                        <div>
                          <span className="text-blue-600">Batch Selling:</span>
                          <span className="ml-1 font-medium text-blue-900">₦{activeBatch.sellingPrice}</span>
                        </div>
                      </div>
                      {(parseFloat(formData.costPrice) !== activeBatch.costPrice || 
                        parseFloat(formData.sellingPrice) !== activeBatch.sellingPrice ||
                        formData.supplier !== activeBatch.supplier ||
                        formData.location !== activeBatch.batchLocation) && (
                        <div className="mt-2 px-2 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800">
                          ⚠️ Updates will also sync to this active batch (prices, supplier, location)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {isLoadingBatch && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-600">Loading batch information...</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Price *
                  </label>
                  <input
                    type="number"
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.costPrice ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
                      errors.sellingPrice ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                </div>

                {formData.costPrice && formData.sellingPrice && (
                  <div className="md:col-span-2">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Profit Margin:</span>
                        <span className={`font-medium ${calculateProfitMargin() > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculateProfitMargin()}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Category Details Tab */}
          {activeTab === 'category' && formData.category && formData.category !== 'Other' && (
            <div className="space-y-8">
              <CategoryDetailsRenderer
                category={formData.category}
                formData={formData}
                handleCategoryDetailChange={handleCategoryDetailChange}
                handleArrayFieldChange={handleArrayFieldChange}
                removeArrayItem={removeArrayItem}
                selectedStateForCity={selectedStateForCity}
                setSelectedStateForCity={setSelectedStateForCity}
                addDeliveryState={addDeliveryState}
                removeDeliveryState={removeDeliveryState}
                toggleCoverAllCitiesInState={toggleCoverAllCitiesInState}
                addCityToDeliveryState={addCityToDeliveryState}
                removeCityFromDeliveryState={removeCityFromDeliveryState}
                detectedColorVariants={detectedColorVariants}
              />
            </div>
          )}

          {/* Additional Info Tab */}
          {activeTab === 'additional' && (
            <div className="space-y-8">
              {/* Tags */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Tags (optional)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map(tag => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.tags.includes(tag.value)
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplier & Location */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Supplier & Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier
                    </label>
                    <input
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      placeholder="e.g., ABC Distributors"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Storage Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g., Main Store"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Additional notes about this product"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer - Always visible */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-inventory-form"
              disabled={isSubmitting || isUploadingImage}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSubmitting ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
