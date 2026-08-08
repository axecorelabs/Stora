"use client";
import { useState, useRef, useEffect } from "react";
import { X, Package, DollarSign, Calendar, Truck, Plus, AlertCircle, Copy, ChevronDown, ChevronUp, Upload, Image as ImageIcon } from "lucide-react";
import CustomDropdown from "../ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";

export default function AddBatchModal({ isOpen, onClose, onSubmit, item }) {
  const { secureFormDataCall } = useAuth();
  
  const [formData, setFormData] = useState({
    quantityIn: '',
    costPrice: '',
    sellingPrice: '',
    supplier: '',
    dateReceived: '',
    expiryDate: '',
    batchLocation: '',
    notes: '',
    hasVariants: false,
    variants: []
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variantQuantities, setVariantQuantities] = useState({});
  
  // Bulk operations state
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [bulkReorderLevel, setBulkReorderLevel] = useState('');
  
  // New variant creation state
  const [showNewVariantForm, setShowNewVariantForm] = useState(false);
  const [newVariant, setNewVariant] = useState({
    size: '',
    color: '',
    quantityIn: '',
    reorderLevel: '5'
  });
  
  // UI state
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    variants: true,
    pricing: false,
    dates: false,
    additional: false
  });

  const locationOptions = [
    { value: '', label: 'Select location' },
    { value: 'Main Store', label: 'Main Store' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Storage Room', label: 'Storage Room' },
    { value: 'Front Display', label: 'Front Display' },
    { value: 'Back Room', label: 'Back Room' },
    { value: 'Freezer', label: 'Freezer' },
    { value: 'Other', label: 'Other' }
  ];

  // Common sizes for quick selection - EXPANDED
  const commonSizes = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Plus Size', 'Kids 2-4', 'Kids 5-7', 'Kids 8-12', 'Custom'];
  
  // Common colors for quick selection - EXPANDED
  const commonColors = [
    'Black', 'White', 'Gray', 'Navy', 'Beige', 'Brown',
    'Red', 'Burgundy', 'Pink', 'Rose', 'Orange', 'Peach',
    'Yellow', 'Gold', 'Cream', 'Mustard',
    'Green', 'Olive', 'Mint', 'Sage',
    'Blue', 'Sky Blue', 'Royal Blue', 'Teal', 'Turquoise',
    'Purple', 'Lavender', 'Violet', 'Mauve',
    'Silver', 'Charcoal', 'Khaki', 'Tan',
    'Multi-Color', 'Custom'
  ];

  // Reset form when modal opens/closes or item changes
  useEffect(() => {
    if (isOpen && item) {
      const hasVariants = item.hasVariants && item.variants && item.variants.length > 0;
      
      const initialVariantQty = {};
      if (hasVariants) {
        item.variants.forEach(v => {
          const key = `${v.color}-${v.size}`;
          initialVariantQty[key] = {
            size: v.size,
            color: v.color,
            variantId: v._id,
            variantSku: v.sku,
            quantityIn: '',
            reorderLevel: v.reorderLevel || 5
          };
        });
      }

      setFormData({
        quantityIn: '',
        costPrice: item.costPrice?.toString() || '',
        sellingPrice: item.sellingPrice?.toString() || '',
        supplier: item.supplier || '',
        dateReceived: new Date().toISOString().split('T')[0],
        expiryDate: '',
        batchLocation: item.location || 'Main Store',
        notes: '',
        hasVariants: hasVariants,
        variants: []
      });
      
      setVariantQuantities(initialVariantQty);
      setBulkQuantity('');
      setBulkReorderLevel('');
      setShowNewVariantForm(false);
      setNewVariant({ size: '', color: '', quantityIn: '', reorderLevel: '5' });
      setErrors({});
    }
  }, [isOpen, item]);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle basic form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLocationChange = (value) => {
    setFormData(prev => ({ ...prev, batchLocation: value }));
    if (errors.batchLocation) {
      setErrors(prev => ({ ...prev, batchLocation: '' }));
    }
  };

  // Handle variant quantity change
  const handleVariantQuantityChange = (variantKey, field, value) => {
    setVariantQuantities(prev => ({
      ...prev,
      [variantKey]: {
        ...prev[variantKey],
        [field]: value
      }
    }));
    
    if (errors[`variant_${variantKey}`]) {
      setErrors(prev => ({ ...prev, [`variant_${variantKey}`]: '' }));
    }
  };

  // Bulk operations
  const applySameQuantityToAll = () => {
    if (!bulkQuantity || parseFloat(bulkQuantity) < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const updatedQuantities = { ...variantQuantities };
    Object.keys(updatedQuantities).forEach(key => {
      updatedQuantities[key].quantityIn = bulkQuantity;
    });
    setVariantQuantities(updatedQuantities);
  };

  const applySameReorderLevelToAll = () => {
    if (!bulkReorderLevel || parseFloat(bulkReorderLevel) < 0) {
      alert('Please enter a valid reorder level');
      return;
    }

    const updatedQuantities = { ...variantQuantities };
    Object.keys(updatedQuantities).forEach(key => {
      updatedQuantities[key].reorderLevel = bulkReorderLevel;
    });
    setVariantQuantities(updatedQuantities);
  };

  // Add new variant
  const handleAddNewVariant = async () => {
    if (!newVariant.size || !newVariant.color || !newVariant.quantityIn) {
      alert('Please fill in size, color, and quantity for the new variant');
      return;
    }

    const variantKey = `${newVariant.color}-${newVariant.size}`;
    
    // Check if variant already exists
    if (variantQuantities[variantKey]) {
      alert('This variant already exists');
      return;
    }

    try {
      // Upload image if provided
      let variantImageUrl = null;
      if (newVariantImage) {
        variantImageUrl = await uploadVariantImage(newVariantImage);
      }

      // Add to variant quantities
      setVariantQuantities(prev => ({
        ...prev,
        [variantKey]: {
          size: newVariant.size,
          color: newVariant.color,
          variantId: null,
          variantSku: '',
          quantityIn: newVariant.quantityIn,
          reorderLevel: newVariant.reorderLevel || 5,
          isNew: true,
          image: variantImageUrl // Store the uploaded image URL
        }
      }));

      // Reset new variant form
      setNewVariant({ size: '', color: '', quantityIn: '', reorderLevel: '5' });
      removeNewVariantImage();
      setShowNewVariantForm(false);
    } catch (error) {
      alert('Failed to upload variant image. Please try again.');
      console.error('Error adding new variant:', error);
    }
  };

  // Add image upload state for new variants
  const [newVariantImage, setNewVariantImage] = useState(null);
  const [newVariantImagePreview, setNewVariantImagePreview] = useState(null);
  const newVariantImageInputRef = useRef(null);

  // Handle new variant image selection
  const handleNewVariantImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        alert('Only JPEG, PNG, and WebP images are allowed');
        return;
      }

      if (file.size > maxSize) {
        alert('Image size must be less than 5MB');
        return;
      }

      setNewVariantImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewVariantImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove new variant image
  const removeNewVariantImage = () => {
    setNewVariantImage(null);
    setNewVariantImagePreview(null);
    if (newVariantImageInputRef.current) {
      newVariantImageInputRef.current.value = '';
    }
  };

  // Upload variant image
  const uploadVariantImage = async (imageFile) => {
    if (!imageFile) return null;

    try {
      const imageFormData = new FormData();
      imageFormData.append('image', imageFile);

      const result = await secureFormDataCall('/api/inventory/upload-image', imageFormData);
      return result.imageUrl;
    } catch (error) {
      console.error('Failed to upload variant image:', error);
      throw error;
    }
  };

  // Calculate total quantity
  const calculateTotalVariantQuantity = () => {
    return Object.values(variantQuantities).reduce((sum, v) => {
      return sum + (parseFloat(v.quantityIn) || 0);
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (formData.hasVariants) {
      const hasAnyQuantity = Object.values(variantQuantities).some(v => 
        v.quantityIn && parseFloat(v.quantityIn) > 0
      );
      
      if (!hasAnyQuantity) {
        newErrors.variants = 'Please enter quantity for at least one variant';
      }
      
      Object.entries(variantQuantities).forEach(([key, variant]) => {
        if (variant.quantityIn && parseFloat(variant.quantityIn) < 0) {
          newErrors[`variant_${key}`] = 'Quantity cannot be negative';
        }
      });
    } else {
      if (!formData.quantityIn || parseFloat(formData.quantityIn) <= 0) {
        newErrors.quantityIn = 'Please enter a valid quantity';
      }
    }

    if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
      newErrors.costPrice = 'Please enter a valid cost price';
    }

    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) {
      newErrors.sellingPrice = 'Please enter a valid selling price';
    }

    if (parseFloat(formData.sellingPrice) < parseFloat(formData.costPrice)) {
      newErrors.sellingPrice = 'Selling price should be higher than cost price';
    }

    if (!formData.dateReceived) {
      newErrors.dateReceived = 'Please select the date received';
    }

    if (formData.expiryDate && formData.dateReceived) {
      if (new Date(formData.expiryDate) <= new Date(formData.dateReceived)) {
        newErrors.expiryDate = 'Expiry date must be after received date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      let batchData = {
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        supplier: formData.supplier.trim(),
        dateReceived: formData.dateReceived,
        expiryDate: formData.expiryDate || null,
        batchLocation: formData.batchLocation || 'Main Store',
        notes: formData.notes.trim(),
        hasVariants: formData.hasVariants
      };

      if (formData.hasVariants) {
        // Build variants array with only those that have quantity
        const batchVariants = Object.values(variantQuantities)
          .filter(v => v.quantityIn && parseFloat(v.quantityIn) > 0)
          .map(v => ({
            size: v.size,
            color: v.color,
            variantId: v.variantId,
            variantSku: v.variantSku,
            quantityIn: parseFloat(v.quantityIn),
            quantitySold: 0,
            quantityRemaining: parseFloat(v.quantityIn),
            reorderLevel: parseFloat(v.reorderLevel) || 5,
            costPrice: parseFloat(formData.costPrice),
            sellingPrice: parseFloat(formData.sellingPrice),
            isActive: true,
            isNew: v.isNew || false, // Include flag for new variants
            image: v.image || null // Include image URL
          }));

        batchData.variants = batchVariants;
        batchData.quantityIn = calculateTotalVariantQuantity();
      } else {
        batchData.quantityIn = parseFloat(formData.quantityIn);
      }
      
      await onSubmit(item._id, batchData);
      
      // Reset form and close modal
      setFormData({
        quantityIn: '',
        costPrice: '',
        sellingPrice: '',
        supplier: '',
        dateReceived: '',
        expiryDate: '',
        batchLocation: '',
        notes: '',
        hasVariants: false,
        variants: []
      });
      setVariantQuantities({});
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to add batch' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate profit margin
  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    if (cost === 0) return 0;
    return (((selling - cost) / cost) * 100).toFixed(1);
  };

  const calculateTotalValue = () => {
    const quantity = formData.hasVariants 
      ? calculateTotalVariantQuantity() 
      : parseFloat(formData.quantityIn) || 0;
    const cost = parseFloat(formData.costPrice) || 0;
    return quantity * cost;
  };

  const calculatePotentialRevenue = () => {
    const quantity = formData.hasVariants 
      ? calculateTotalVariantQuantity() 
      : parseFloat(formData.quantityIn) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    return quantity * selling;
  };

  // Add state for collapsed variant groups
  const [expandedVariants, setExpandedVariants] = useState({});

  // Toggle variant group expansion
  const toggleVariantGroup = (color) => {
    setExpandedVariants(prev => ({
      ...prev,
      [color]: !prev[color]
    }));
  };

  // Group variants by color
  const getVariantsByColor = () => {
    const grouped = {};
    Object.entries(variantQuantities).forEach(([key, variant]) => {
      if (!grouped[variant.color]) {
        grouped[variant.color] = [];
      }
      grouped[variant.color].push({ key, ...variant });
    });
    return grouped;
  };

  // Get unique colors from existing variants
  const getExistingColors = () => {
    if (!item || !item.variants) return [];
    const colors = [...new Set(item.variants.map(v => v.color))];
    return colors;
  };

  // Get sizes for a specific color
  const getSizesForColor = (color) => {
    if (!item || !item.variants) return [];
    return item.variants.filter(v => v.color === color).map(v => v.size);
  };

  // Add state for adding new sizes to existing colors
  const [showAddSizeForm, setShowAddSizeForm] = useState(false);
  const [selectedColorForNewSize, setSelectedColorForNewSize] = useState('');
  const [newSizeForColor, setNewSizeForColor] = useState({
    size: '',
    quantityIn: '',
    reorderLevel: '5',
    image: null,
    imagePreview: null
  });
  const newSizeImageInputRef = useRef(null);

  // Handle new size image selection
  const handleNewSizeImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024;

      if (!allowedTypes.includes(file.type)) {
        alert('Only JPEG, PNG, and WebP images are allowed');
        return;
      }

      if (file.size > maxSize) {
        alert('Image size must be less than 5MB');
        return;
      }

      setNewSizeForColor(prev => ({ ...prev, image: file }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setNewSizeForColor(prev => ({ ...prev, imagePreview: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove new size image
  const removeNewSizeImage = () => {
    setNewSizeForColor(prev => ({ ...prev, image: null, imagePreview: null }));
    if (newSizeImageInputRef.current) {
      newSizeImageInputRef.current.value = '';
    }
  };

  // Handle adding new size to existing color
  const handleAddNewSizeToColor = async () => {
    if (!selectedColorForNewSize || !newSizeForColor.size || !newSizeForColor.quantityIn) {
      alert('Please select a color and fill in size and quantity');
      return;
    }

    const variantKey = `${selectedColorForNewSize}-${newSizeForColor.size}`;
    
    // Check if this size already exists for the selected color
    if (variantQuantities[variantKey]) {
      alert(`Size ${newSizeForColor.size} already exists for ${selectedColorForNewSize}`);
      return;
    }

    try {
      // Upload image if provided
      let variantImageUrl = null;
      if (newSizeForColor.image) {
        const imageFormData = new FormData();
        imageFormData.append('image', newSizeForColor.image);
        const result = await secureFormDataCall('/api/inventory/upload-image', imageFormData);
        variantImageUrl = result.imageUrl;
      }

      // Add to variant quantities
      setVariantQuantities(prev => ({
        ...prev,
        [variantKey]: {
          size: newSizeForColor.size,
          color: selectedColorForNewSize,
          variantId: null, // New size - no ID yet
          variantSku: '', // Will be generated by backend
          quantityIn: newSizeForColor.quantityIn,
          reorderLevel: newSizeForColor.reorderLevel || 5,
          isNew: true, // Flag to indicate this is a new size
          image: variantImageUrl
        }
      }));

      // Reset form
      setNewSizeForColor({ size: '', quantityIn: '', reorderLevel: '5', image: null, imagePreview: null });
      setSelectedColorForNewSize('');
      setShowAddSizeForm(false);
      
      alert(`Successfully added new size ${newSizeForColor.size} for ${selectedColorForNewSize}`);
    } catch (error) {
      alert('Failed to upload variant image. Please try again.');
      console.error('Error adding new size:', error);
    }
  };

  // Add state for quick size addition modal
  const [isQuickSizeModalOpen, setIsQuickSizeModalOpen] = useState(false);
  const [selectedColorForQuickSize, setSelectedColorForQuickSize] = useState('');
  const [quickSizeData, setQuickSizeData] = useState({
    size: '',
    quantityIn: '',
    reorderLevel: '5'
  });

  // Handle opening quick size modal
  const openQuickSizeModal = (color) => {
    setSelectedColorForQuickSize(color);
    setQuickSizeData({ size: '', quantityIn: '', reorderLevel: '5' });
    setIsQuickSizeModalOpen(true);
  };

  // Handle adding size through quick modal
  const handleQuickAddSize = () => {
    if (!quickSizeData.size || !quickSizeData.quantityIn) {
      alert('Please fill in size and quantity');
      return;
    }

    const variantKey = `${selectedColorForQuickSize}-${quickSizeData.size}`;
    
    // Check if this size already exists for the color
    if (variantQuantities[variantKey]) {
      alert(`Size ${quickSizeData.size} already exists for ${selectedColorForQuickSize}`);
      return;
    }

    // Add the new size to variant quantities
    setVariantQuantities(prev => ({
      ...prev,
      [variantKey]: {
        size: quickSizeData.size,
        color: selectedColorForQuickSize,
        variantId: null,
        variantSku: '',
        quantityIn: quickSizeData.quantityIn,
        reorderLevel: quickSizeData.reorderLevel || 5,
        isNew: true
      }
    }));

    // Close modal and reset
    setIsQuickSizeModalOpen(false);
    setSelectedColorForQuickSize('');
    setQuickSizeData({ size: '', quantityIn: '', reorderLevel: '5' });
  };

  // Get existing sizes for a specific color
  const getExistingSizesForColor = (color) => {
    if (!item || !item.variants) return [];
    return item.variants
      .filter(v => v.color === color)
      .map(v => v.size);
  };

  // Get available sizes for the selected color (exclude existing sizes)
  const getAvailableSizesForColor = (color) => {
    if (!color) return commonSizes;
    
    const existingSizes = getExistingSizesForColor(color);
    return commonSizes.filter(size => !existingSizes.includes(size));
  };

  if (!isOpen || !item) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add New Batch</h2>
                <p className="text-sm text-gray-500">
                  {item.productName}
                  {formData.hasVariants && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      Has Variants
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {errors.submit && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Basic Stock Information - Always Expanded */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('basicInfo')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-gray-600" />
                    <h3 className="text-base font-semibold text-gray-900">Stock & Location</h3>
                  </div>
                  {expandedSections.basicInfo ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {expandedSections.basicInfo && (
                  <div className="p-4 space-y-4">
                  {!formData.hasVariants && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity Received *
                      </label>
                      <input
                        type="number"
                        name="quantityIn"
                        value={formData.quantityIn}
                        onChange={handleChange}
                        min="0"
                        step="1"
                        placeholder="Enter quantity"
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-400 ${
                          errors.quantityIn ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.quantityIn && (
                        <p className="text-red-500 text-xs mt-1">{errors.quantityIn}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Unit: {item.unitOfMeasure}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Storage Location
                    </label>
                    <CustomDropdown
                      options={locationOptions}
                      value={formData.batchLocation}
                      onChange={handleLocationChange}
                      placeholder="Select storage location"
                      error={!!errors.batchLocation}
                    />
                  </div>
                </div>
                )}
              </div>

              {/* Variants Section */}
              {formData.hasVariants && (
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection('variants')}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <h3 className="text-base font-semibold text-purple-900">
                        Variant Quantities ({Object.keys(variantQuantities).length} variants)
                      </h3>
                    </div>
                    {expandedSections.variants ? <ChevronUp className="w-5 h-5 text-purple-600" /> : <ChevronDown className="w-5 h-5 text-purple-600" />}
                  </button>
                  
                  {expandedSections.variants && (
                    <div className="p-4 space-y-4">
                      {/* Bulk Operations */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-3">Quick Fill Options</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">Same Quantity for All</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={bulkQuantity}
                                onChange={(e) => setBulkQuantity(e.target.value)}
                                min="0"
                                step="1"
                                placeholder="Quantity"
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm text-black placeholder-gray-400"
                              />
                              <button
                                type="button"
                                onClick={applySameQuantityToAll}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-blue-900 mb-1">Same Reorder Level</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={bulkReorderLevel}
                                onChange={(e) => setBulkReorderLevel(e.target.value)}
                                min="0"
                                step="1"
                                placeholder="Level"
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm text-black placeholder-gray-400"
                              />
                              <button
                                type="button"
                                onClick={applySameReorderLevelToAll}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {errors.variants && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-600 text-sm">{errors.variants}</p>
                        </div>
                      )}

                      {/* Variants Grouped by Color - Collapsible Tables */}
                      <div className="space-y-3">
                        {Object.entries(getVariantsByColor()).map(([color, colorVariants]) => {
                          const isExpanded = expandedVariants[color] !== false;
                          const totalQuantity = colorVariants.reduce((sum, v) => sum + (parseInt(v.quantityIn) || 0), 0);
                          
                          return (
                            <div key={color} className="border border-gray-200 rounded-xl overflow-hidden">
                              {/* Color Header - UPDATED WITH ADD SIZE BUTTON */}
                              <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => toggleVariantGroup(color)}
                                  className="flex items-center space-x-3 flex-1"
                                >
                                  <div 
                                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                                    style={{ backgroundColor: color.toLowerCase() }}
                                    title={color}
                                  />
                                  <div className="text-left">
                                    <h5 className="text-sm font-semibold text-gray-900">{color}</h5>
                                    <p className="text-xs text-gray-500">
                                      {colorVariants.length} size{colorVariants.length !== 1 ? 's' : ''}
                                      {totalQuantity > 0 && ` • ${totalQuantity} units`}
                                    </p>
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-600 ml-auto" /> : <ChevronDown className="w-5 h-5 text-gray-600 ml-auto" />}
                                </button>

                                {/* Add Size Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuickSizeModal(color);
                                  }}
                                  className="ml-3 flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Size</span>
                                </button>
                              </div>

                              {/* Variants Table */}
                              {isExpanded && (
                                <div className="border-t border-gray-200">
                                  <table className="w-full">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Size</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">SKU</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Quantity</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Reorder Level</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {colorVariants.map((variant) => (
                                        <tr key={variant.key} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3">
                                            <span className="text-sm font-medium text-gray-900">{variant.size}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="text-xs text-gray-500 font-mono">{variant.variantSku}</span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <input
                                              type="number"
                                              value={variant.quantityIn}
                                              onChange={(e) => handleVariantQuantityChange(variant.key, 'quantityIn', e.target.value)}
                                              min="0"
                                              step="1"
                                              placeholder="0"
                                              className={`w-24 px-3 py-1.5 border rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                errors[`variant_${variant.key}`] ? 'border-red-300' : 'border-gray-300'
                                              }`}
                                            />
                                            {errors[`variant_${variant.key}`] && (
                                              <p className="text-red-500 text-xs mt-1">{errors[`variant_${variant.key}`]}</p>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            <input
                                              type="number"
                                              value={variant.reorderLevel}
                                              onChange={(e) => handleVariantQuantityChange(variant.key, 'reorderLevel', e.target.value)}
                                              min="0"
                                              step="1"
                                              placeholder="5"
                                              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      

                      {/* Add New Variant Button */}
                      {!showNewVariantForm && (
                        <button
                          type="button"
                          onClick={() => setShowNewVariantForm(true)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="font-medium">Add New Variant</span>
                        </button>
                      )}

                      {/* New Variant Form */}
                      {showNewVariantForm && (
                        <div className="border-2 border-blue-300 rounded-xl p-5 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-semibold text-gray-900 flex items-center">
                              <Plus className="w-5 h-5 text-blue-600 mr-2" />
                              Create New Variant
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewVariantForm(false);
                                removeNewVariantImage();
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            {/* Variant Image Upload */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Variant Image (Optional)
                              </label>
                              
                              {newVariantImagePreview ? (
                                <div className="relative">
                                  <img
                                    src={newVariantImagePreview}
                                    alt="Variant preview"
                                    className="w-full h-32 object-cover rounded-xl"
                                  />
                                  <button
                                    type="button"
                                    onClick={removeNewVariantImage}
                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => newVariantImageInputRef.current?.click()}
                                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                                >
                                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500">Click to upload variant image</p>
                                  <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP (max 5MB)</p>
                                </div>
                              )}
                              
                              <input
                                ref={newVariantImageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleNewVariantImageSelect}
                                className="hidden"
                              />
                            </div>

                            {/* Color Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color *
                              </label>
                              <input
                                type="text"
                                value={newVariant.color}
                                onChange={(e) => setNewVariant(prev => ({ ...prev, color: e.target.value }))}
                                placeholder="Enter or select color"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <div className="mt-2 max-h-32 overflow-y-auto">
                                <div className="grid grid-cols-4 gap-1.5">
                                  {commonColors.map(color => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setNewVariant(prev => ({ ...prev, color }))}
                                      className={`text-xs px-2 py-1.5 rounded transition-colors ${
                                        newVariant.color === color
                                          ? 'bg-blue-600 text-white font-medium'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    >
                                      {color}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Size Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Size *
                              </label>
                              <input
                                type="text"
                                value={newVariant.size}
                                onChange={(e) => setNewVariant(prev => ({ ...prev, size: e.target.value }))}
                                placeholder="Enter or select size"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <div className="mt-2">
                                <div className="grid grid-cols-4 gap-1.5">
                                  {commonSizes.map(size => (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => setNewVariant(prev => ({ ...prev, size }))}
                                      className={`text-xs px-2 py-1.5 rounded transition-colors ${
                                        newVariant.size === size
                                          ? 'bg-blue-600 text-white font-medium'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Quantity and Reorder Level */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Quantity *
                                </label>
                                <input
                                  type="number"
                                  value={newVariant.quantityIn}
                                  onChange={(e) => setNewVariant(prev => ({ ...prev, quantityIn: e.target.value }))}
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Reorder Level
                                </label>
                                <input
                                  type="number"
                                  value={newVariant.reorderLevel}
                                  onChange={(e) => setNewVariant(prev => ({ ...prev, reorderLevel: e.target.value }))}
                                  min="0"
                                  step="1"
                                  placeholder="5"
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>

                            {/* Add Button */}
                            <button
                              type="button"
                              onClick={handleAddNewVariant}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add Variant</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Total Summary */}
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-900">Total Batch Quantity:</span>
                          <span className="text-lg font-bold text-blue-900">
                            {calculateTotalVariantQuantity()} {item.unitOfMeasure}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pricing Section - Collapsible */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('pricing')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-gray-600" />
                    <h3 className="text-base font-semibold text-gray-900">Pricing Information</h3>
                  </div>
                  {expandedSections.pricing ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {expandedSections.pricing && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cost Price per Unit *</label>
                        <input
                          type="number"
                          name="costPrice"
                          value={formData.costPrice}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className={`w-full px-4 py-3 border rounded-xl text-black placeholder-gray-400 ${
                            errors.costPrice ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price per Unit *</label>
                        <input
                          type="number"
                          name="sellingPrice"
                          value={formData.sellingPrice}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className={`w-full px-4 py-3 border rounded-xl text-black placeholder-gray-400 ${
                            errors.sellingPrice ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                      </div>
                    </div>

                    {formData.costPrice && formData.sellingPrice && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-gray-900">{calculateProfitMargin()}%</div>
                            <div className="text-xs text-gray-500">Profit Margin</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-600">₦{calculateTotalValue().toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Total Investment</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">₦{calculatePotentialRevenue().toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Potential Revenue</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dates & Additional - Collapsed by default */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('dates')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <h3 className="text-base font-semibold text-gray-900">Dates & Supplier</h3>
                  </div>
                  {expandedSections.dates ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {expandedSections.dates && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Received *</label>
                        <input
                          type="date"
                          name="dateReceived"
                          value={formData.dateReceived}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-xl text-black ${
                            errors.dateReceived ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.dateReceived && <p className="text-red-500 text-xs mt-1">{errors.dateReceived}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date (Optional)</label>
                        <input
                          type="date"
                          name="expiryDate"
                          value={formData.expiryDate}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-xl text-black ${
                            errors.expiryDate ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.expiryDate && <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                      <input
                        type="text"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleChange}
                        placeholder="Supplier name (optional)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-black placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Any additional notes about this batch..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-black placeholder-gray-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding Batch...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Batch
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Quick Add Size Modal */}
      {isQuickSizeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Size to {selectedColorForQuickSize}</h3>
                <p className="text-sm text-gray-500 mt-1">Quickly add a new size variant</p>
              </div>
              <button
                onClick={() => setIsQuickSizeModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Color Display */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: selectedColorForQuickSize.toLowerCase() }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedColorForQuickSize}</p>
                  <p className="text-xs text-gray-500">Selected color</p>
                </div>
              </div>

              {/* Existing Sizes Info */}
              {getExistingSizesForColor(selectedColorForQuickSize).length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-medium text-blue-900 mb-1">Existing sizes:</p>
                  <div className="flex flex-wrap gap-1">
                    {getExistingSizesForColor(selectedColorForQuickSize).map(size => (
                      <span key={size} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {size}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection - Only show available sizes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size * {getAvailableSizesForColor(selectedColorForQuickSize).length === 0 && (
                    <span className="text-red-600 text-xs ml-1">(All sizes added)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={quickSizeData.size}
                  onChange={(e) => setQuickSizeData(prev => ({ ...prev, size: e.target.value }))}
                  placeholder={getAvailableSizesForColor(selectedColorForQuickSize).length === 0 ? "No available sizes" : "Enter or select size"}
                  disabled={getAvailableSizesForColor(selectedColorForQuickSize).length === 0}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                
                {getAvailableSizesForColor(selectedColorForQuickSize).length > 0 ? (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {getAvailableSizesForColor(selectedColorForQuickSize).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setQuickSizeData(prev => ({ ...prev, size }))}
                        className={`text-xs px-2 py-1.5 rounded transition-colors ${
                          quickSizeData.size === size
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    All sizes have been added for this color. You can still enter a custom size above.
                  </p>
                )}
              </div>

              {/* Quantity and Reorder Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={quickSizeData.quantityIn}
                    onChange={(e) => setQuickSizeData(prev => ({ ...prev, quantityIn: e.target.value }))}
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={quickSizeData.reorderLevel}
                    onChange={(e) => setQuickSizeData(prev => ({ ...prev, reorderLevel: e.target.value }))}
                    min="0"
                    step="1"
                    placeholder="5"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setIsQuickSizeModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddSize}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Size</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
