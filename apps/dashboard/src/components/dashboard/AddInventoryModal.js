"use client";
import { useState, useRef, useEffect } from "react";
import { X, Package, Tag, DollarSign, ChevronRight, ChevronLeft, Check } from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";

// Import modular components
import ImageUploadSection from "./Inventory/ImageUploadSection";
import VariantManager from "./Inventory/VariantManager";
import CategoryDetailsRenderer from "./Inventory/Categories/CategoryDetailsRenderer";

export default function AddInventoryModal({ isOpen, onClose, onSubmit }) {
  const { secureFormDataCall } = useAuth();
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

  // Nigerian states and cities data (expanded)
  const NIGERIAN_STATES = {
    'Lagos': ['Ikeja', 'Lagos Island', 'Lekki', 'Ikorodu', 'Epe', 'Badagry', 'Victoria Island', 'Yaba', 'Surulere', 'Ajah'],
    'Abuja': ['Central Area', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Kubwa', 'Lugbe'],
    'Oyo': ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin'],
    'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota'],
    'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme'],
    'Kano': ['Kano', 'Wudil', 'Bichi', 'Gwarzo'],
    // Add more states as needed
  };

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const [selectedStateForCity, setSelectedStateForCity] = useState('');

  // Delivery location handlers for Food/Beverages
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle category change - initialize category-specific details
  const handleCategoryChange = (value) => {
    handleChange({ target: { name: 'category', value } });
    
    // Initialize category-specific details based on category
    const newFormData = { ...formData, category: value };
    
    if (value === 'Food') {
      newFormData.unitOfMeasure = 'Plate (Takeaway)';
      newFormData.foodDetails = {
        foodType: '',
        cuisineType: [],
        servingSize: '',
        ingredients: [],
        allergens: [],
        spiceLevel: '',
        deliveryLocations: { states: [] },
        orderingHours: DAYS.map(day => ({
          day,
          isAvailable: true,
          startTime: '09:00',
          endTime: '21:00'
        })),
        deliveryTime: { value: 30, unit: 'minutes' },
        maxOrdersPerDay: ''
      };
    } else if (value === 'Beverages') {
      newFormData.beveragesDetails = {
        beverageType: '',
        volume: '',
        packaging: '',
        ingredients: [],
        isAlcoholic: false,
        alcoholContent: '',
        isCarbonated: false,
        flavorProfile: [],
        deliveryLocations: { states: [] },
        orderingHours: DAYS.map(day => ({
          day,
          isAvailable: true,
          startTime: '09:00',
          endTime: '21:00'
        })),
        deliveryTime: { value: 30, unit: 'minutes' },
        maxOrdersPerDay: ''
      };
    } else if (value === 'Clothing') {
      newFormData.clothingDetails = {
        gender: 'Unisex',
        productType: '',
        sizes: [],
        colors: [],
        material: '',
        style: [],
        occasion: []
      };
    } else if (value === 'Shoes') {
      newFormData.shoesDetails = {
        gender: 'Unisex',
        shoeType: '',
        sizes: [],
        colors: [],
        material: '',
        occasion: []
      };
    } else if (value === 'Accessories') {
      newFormData.accessoriesDetails = {
        accessoryType: '',
        gender: 'Unisex',
        colors: [],
        material: ''
      };
    } else if (value === 'Perfumes') {
      newFormData.perfumeDetails = {
        fragranceType: '',
        gender: 'Unisex',
        volume: '',
        scentFamily: '',
        concentration: '',
        occasion: []
      };
    } else if (value === 'Electronics') {
      newFormData.electronicsDetails = {
        productType: '',
        model: '',
        specifications: {},
        condition: 'New',
        warranty: { hasWarranty: false, duration: '', type: '' },
        colors: [],
        connectivity: []
      };
    } else if (value === 'Books') {
      newFormData.booksDetails = {
        bookType: '',
        author: '',
        publisher: '',
        isbn: '',
        publicationYear: null,
        language: 'English',
        pages: null,
        format: 'Paperback',
        condition: 'New',
        genre: []
      };
    } else if (value === 'Home & Garden') {
      newFormData.homeGardenDetails = {
        productType: '',
        room: [],
        material: '',
        dimensions: { length: '', width: '', height: '', weight: '' },
        color: [],
        assemblyRequired: false,
        careInstructions: ''
      };
    } else if (value === 'Sports') {
      newFormData.sportsDetails = {
        sportType: '',
        productType: '',
        sizes: [],
        colors: [],
        material: '',
        suitableFor: [],
        performanceLevel: 'All Levels'
      };
    } else if (value === 'Automotive') {
      newFormData.automotiveDetails = {
        productType: '',
        compatibleVehicles: [],
        partNumber: '',
        condition: 'New',
        warranty: { hasWarranty: false, duration: '' },
        specifications: ''
      };
    } else if (value === 'Health & Beauty') {
      newFormData.healthBeautyDetails = {
        productType: '',
        skinType: [],
        ingredients: [],
        suitableFor: [],
        volume: '',
        scent: '',
        benefits: [],
        applicationArea: [],
        isOrganic: false,
        expiryDate: null
      };
    }
    
    setFormData(newFormData);
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

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    // Skip quantity validation if variants are detected (will use variant total)
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

  // Validate each step
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.productName.trim()) {
        newErrors.productName = 'Product name is required';
      }
      if (!formData.category.trim()) {
        newErrors.category = 'Category is required';
      }
    }

    if (step === 3) {
      // Skip quantity validation if variants are detected
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
    setErrors({});
  };

  // Handle multiple image upload
  const handleMultiImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImages.length + files.length > 10) {
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
    setFormData(prev => ({
      ...prev,
      hasVariants: !prev.hasVariants,
      variants: !prev.hasVariants ? prev.variants : [],
      quantityInStock: !prev.hasVariants ? '' : prev.quantityInStock
    }));

    if (!formData.hasVariants) {
      setShowVariantManager(true);
    }
  };

  // Get available colors from category details
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

  // Get available sizes from category details - but don't use it to limit variant manager
  const getAvailableSizes = () => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      return formData.clothingDetails.sizes || [];
    }
    if (formData.category === 'Shoes' && formData.shoesDetails) {
      return formData.shoesDetails.sizes || [];
    }
    return [];
  };

  // Function to sync sizes from variant manager to category details
  // This is one-way: variants → category details (not the reverse)
  const syncSizesToCategory = (sizes) => {
    if (formData.category === 'Clothing' && formData.clothingDetails) {
      setFormData(prev => ({
        ...prev,
        clothingDetails: {
          ...prev.clothingDetails,
          sizes: sizes // Replace with all unique sizes from variants
        }
      }));
    } else if (formData.category === 'Shoes' && formData.shoesDetails) {
      setFormData(prev => ({
        ...prev,
        shoesDetails: {
          ...prev.shoesDetails,
          sizes: sizes // Replace with all unique sizes from variants
        }
      }));
    }
  };

  // Check for duplicate variant
  const isDuplicateVariant = (size, color, excludeIndex = null) => {
    return formData.variants.some((variant, index) => 
      index !== excludeIndex && 
      variant.size === size && 
      variant.color === color
    );
  };

  // Add or update variant
  const handleSaveVariant = () => {
    if (!tempVariant.size || !tempVariant.color) {
      alert('Please select both size and color');
      return;
    }

    if (!tempVariant.quantityInStock || tempVariant.quantityInStock < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    if (isDuplicateVariant(tempVariant.size, tempVariant.color, editingVariantIndex)) {
      alert('This size/color combination already exists');
      return;
    }

    // Get images tagged with this color
    const variantImages = imagePreviews
      .filter(img => img.colorTag === tempVariant.color)
      .map(img => img.url);

    const newVariant = {
      ...tempVariant,
      quantityInStock: parseInt(tempVariant.quantityInStock),
      reorderLevel: parseInt(tempVariant.reorderLevel) || 5,
      images: variantImages,
      sku: `${formData.category.substring(0, 3).toUpperCase()}-${tempVariant.color.substring(0, 3).toUpperCase()}-${tempVariant.size}`
    };

    if (editingVariantIndex !== null) {
      // Update existing variant
      const updatedVariants = [...formData.variants];
      updatedVariants[editingVariantIndex] = newVariant;
      setFormData(prev => ({ ...prev, variants: updatedVariants }));
      setEditingVariantIndex(null);
    } else {
      // Add new variant
      setFormData(prev => ({
        ...prev,
        variants: [...prev.variants, newVariant]
      }));
    }

    // Reset temp variant
    setTempVariant({
      size: '',
      color: '',
      quantityInStock: '',
      reorderLevel: 5,
      images: []
    });
  };

  const editVariant = (index) => {
    setTempVariant(formData.variants[index]);
    setEditingVariantIndex(index);
  };

  const deleteVariant = (index) => {
    if (confirm('Are you sure you want to delete this variant?')) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter((_, i) => i !== index)
      }));
    }
  };

  const handleVariantsDetected = (colors) => {
    setDetectedColorVariants(colors);
    
    // Update formData hasVariants based on detection
    setFormData(prev => ({
      ...prev,
      hasVariants: colors.length >= 2
    }));
  };

  // Calculate total stock from variants - Make this more robust
  const calculateTotalStock = () => {
    if (!variants || variants.length === 0) {
      console.log('No variants found');
      return 0;
    }
    
    const total = variants.reduce((total, variant) => {
      if (!variant.sizes || !Array.isArray(variant.sizes)) {
        console.log('Variant missing sizes:', variant);
        return total;
      }
      
      const variantTotal = variant.sizes.reduce((sum, size) => {
        const qty = parseInt(size.quantityInStock) || 0;
        return sum + qty;
      }, 0);
      
      return total + variantTotal;
    }, 0);
    
    console.log('Total stock calculated:', total, 'from variants:', variants);
    return total;
  };

  // Function to sync total stock from variant manager to stock field
  const syncStockToForm = () => {
    // Force recalculation by passing current variants
    const totalStock = variants.reduce((total, variant) => {
      if (!variant.sizes || !Array.isArray(variant.sizes)) return total;
      return total + variant.sizes.reduce((sum, size) => {
        return sum + (parseInt(size.quantityInStock) || 0);
      }, 0);
    }, 0);
    
    console.log('Syncing stock to form:', totalStock);
    
    setFormData(prev => ({
      ...prev,
      quantityInStock: totalStock.toString()
    }));
    
    // Clear any stock validation errors when syncing
    if (errors.quantityInStock) {
      setErrors(prev => ({ ...prev, quantityInStock: '' }));
    }
  };

  // Add useEffect to sync whenever variants change
  useEffect(() => {
    if (detectedColorVariants.length >= 2 && variants && variants.length > 0) {
      // Recalculate and sync stock whenever variants change
      const totalStock = variants.reduce((total, variant) => {
        if (!variant.sizes || !Array.isArray(variant.sizes)) return total;
        return total + variant.sizes.reduce((sum, size) => {
          return sum + (parseInt(size.quantityInStock) || 0);
        }, 0);
      }, 0);
      
      console.log('Variants changed, new total:', totalStock);
      
      setFormData(prev => ({
        ...prev,
        quantityInStock: totalStock.toString()
      }));
    }
  }, [variants, detectedColorVariants.length]);

  // Upload multiple images
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

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Only allow submission if we're on the last step (step 4)
    if (currentStep !== 4) {
      return;
    }
    
    // Ensure stock is synced before validation
    if (detectedColorVariants.length >= 2) {
      const totalStock = calculateTotalStock();
      setFormData(prev => ({
        ...prev,
        quantityInStock: totalStock.toString()
      }));
    }
    
    if (!validateForm()) return;

    // Validate images
    if (imagePreviews.length === 0) {
      setErrors({ submit: 'Please upload at least one product image' });
      return;
    }

    // Validate variants if detected
    if (detectedColorVariants.length >= 2) {
      if (variants.length === 0 || variants.every(v => v.sizes.length === 0)) {
        setErrors({ submit: 'Please configure sizes and stock for your color variants' });
        return;
      }
      
      // Validate total stock
      const totalStock = calculateTotalStock();
      if (totalStock === 0) {
        setErrors({ submit: 'Please add stock quantities to your variants' });
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Upload all images
      const uploadedUrls = await uploadMultipleImages();
      const imagesData = imagePreviews.map((preview, index) => ({
        url: uploadedUrls[index],
        colorTag: preview.colorTag,
        isPrimary: preview.isPrimary,
        altText: `${formData.productName} - ${preview.colorTag || 'Image'}`
      }));
      
      // Set primary image as main image for backward compatibility
      const imageUrl = imagesData.find(img => img.isPrimary)?.url || imagesData[0]?.url;

      // Transform variants to match schema
      const transformedVariants = variants.flatMap(colorVariant =>
        colorVariant.sizes.map(sizeObj => ({
          size: sizeObj.size,
          color: colorVariant.color,
          quantityInStock: parseInt(sizeObj.quantityInStock) || 0,
          reorderLevel: sizeObj.reorderLevel || 5,
          soldQuantity: 0,
          images: imagePreviews
            .filter(img => img.colorTag === colorVariant.color)
            .map(img => uploadedUrls[imagePreviews.indexOf(img)]),
          sku: `${formData.category.substring(0, 3).toUpperCase()}-${colorVariant.color.substring(0, 3).toUpperCase()}-${sizeObj.size}`,
          isActive: true
        }))
      );

      // Calculate final total stock
      const finalTotalStock = detectedColorVariants.length >= 2 
        ? calculateTotalStock() 
        : parseFloat(formData.quantityInStock);

      // Convert warranty object to string for Electronics and Automotive
      const processedFormData = { ...formData };
      
      if (formData.electronicsDetails?.warranty) {
        const warranty = formData.electronicsDetails.warranty;
        processedFormData.electronicsDetails = {
          ...formData.electronicsDetails,
          warranty: warranty.hasWarranty 
            ? `${warranty.duration}${warranty.type ? ` (${warranty.type})` : ''}`
            : ''
        };
      }
      
      if (formData.automotiveDetails?.warranty) {
        const warranty = formData.automotiveDetails.warranty;
        processedFormData.automotiveDetails = {
          ...formData.automotiveDetails,
          warranty: warranty.hasWarranty 
            ? warranty.duration 
            : ''
        };
      }

      // Convert form data
      const inventoryData = {
        ...processedFormData,
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        quantityInStock: finalTotalStock,
        totalStockedQuantity: finalTotalStock,
        soldQuantity: 0,
        reorderLevel: parseInt(formData.reorderLevel),
        image: imageUrl,
        images: imagesData,
        hasVariants: detectedColorVariants.length >= 2,
        variants: transformedVariants
      };
      
      await onSubmit(inventoryData);
      
      // Reset form
      setFormData({
        productName: '',
        category: '',
        description: '',
        brand: '',
        unitOfMeasure: 'Piece',
        quantityInStock: '',
        reorderLevel: '5',
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
      setSelectedImages([]);
      setImagePreviews([]);
      setDetectedColorVariants([]);
      setVariants([]);
      setErrors({});
      setCurrentStep(1);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to add inventory item' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    if (cost === 0) return 0;
    return (((selling - cost) / cost) * 100).toFixed(1);
  };

  // Function to add color to category details
  const addColorToCategory = (colorName) => {
    const trimmedColor = colorName.trim();
    if (!trimmedColor) return;

    // Determine which category details to update
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

  if (!isOpen) return null;

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Product details' },
    { number: 2, title: 'Images & Variants', description: 'Photos & options' },
    { number: 3, title: 'Stock & Pricing', description: 'Inventory & money' },
    { number: 4, title: 'Additional Details', description: 'Extra info' }
  ];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-[75vw] max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Package className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add New Product</h2>
              <p className="text-sm text-gray-500">Step {currentStep} of 4: {steps[currentStep - 1].title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                    currentStep > step.number
                      ? 'bg-teal-600 text-white'
                      : currentStep === step.number
                      ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${
                      currentStep === step.number ? 'text-teal-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-8 ${
                    currentStep > step.number ? 'bg-teal-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => {
          e.preventDefault();
          // Don't do anything - only the explicit button click will trigger submission
        }} onKeyDown={(e) => {
          // Prevent Enter key from submitting the form
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            e.stopPropagation();
          }
        }} className="p-6 overflow-y-auto max-h-[calc(95vh-280px)]">
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
              selectedStateForCity={selectedStateForCity}
              setSelectedStateForCity={setSelectedStateForCity}
              addDeliveryState={addDeliveryState}
              removeDeliveryState={removeDeliveryState}
              toggleCoverAllCitiesInState={toggleCoverAllCitiesInState}
              addCityToDeliveryState={addCityToDeliveryState}
              removeCityFromDeliveryState={removeCityFromDeliveryState}
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black ${
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
                        ? 'bg-teal-600 text-white'
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
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
              onClick={onClose}
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
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors flex items-center"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isUploadingImage}
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
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
    </div>
  );
}
