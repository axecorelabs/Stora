"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { X, ChevronLeft, ChevronRight, Upload, Trash2 } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";

const STEPS = [
  { id: 1, title: "Service Details", description: "Basic information" },
  { id: 2, title: "Service Location", description: "Where you serve" },
  { id: 3, title: "Availability", description: "When you work" },
  { id: 4, title: "Portfolio", description: "Service images" }
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CATEGORIES = [
  { value: 'Beauty & Personal Care', label: 'Beauty & Personal Care' },
  { value: 'Fashion & Style', label: 'Fashion & Style' },
  { value: 'Events & Creative Lifestyle', label: 'Events & Creative Lifestyle' },
  { value: 'Home & Domestic', label: 'Home & Domestic' },
  { value: 'Mobile & Personal Convenience', label: 'Mobile & Personal Convenience' },
  { value: 'Food & Everyday Living', label: 'Food & Everyday Living' }
];

const SUB_CATEGORIES = {
  'Beauty & Personal Care': ['Barbing', 'Hairdressing', 'Hair Revamping / Wig Making', 'Makeup Artistry', 'Skincare / Facials', 'Nail Tech (Manicure, Pedicure)', 'Lash Tech', 'Spa & Massage Services'],
  'Fashion & Style': ['Tailoring', 'Fashion Design', 'Cloth Repairs / Adjustments', 'Styling Services', 'Laundry & Ironing', 'Dry Cleaning', 'Shoe Repair & Bag Repair', 'Personal Shopper'],
  'Events & Creative Lifestyle': ['Event Decoration', 'Event Planning', 'Catering', 'Photography', 'Videography', 'Cake Baking', 'MC / Hosting', 'DJ Services', 'Small Chops & Cocktail Mixology'],
  'Home & Domestic': ['Cleaning Services', 'House Painting', 'Plumbing (Small Repairs)', 'Electrical Repairs', 'AC Fixing / Servicing', 'Interior Décor', 'Pest Control', 'Laundry Pickup/Delivery'],
  'Mobile & Personal Convenience': ['Errand Services', 'Dispatch Delivery', 'Car Wash (Mobile or Fixed)', 'Phone Repair', 'Device Setup', 'Home Tutoring', 'Fitness Training (Personal Trainer)', 'Babysitting / Caregiving'],
  'Food & Everyday Living': ['Meal Prep Services', 'Home Cooking Services', 'Smoothie & Juice Services', 'Snacks & Pastries', 'Food Delivery Services']
};

const NIGERIAN_STATES = {
  'Abia': ['Aba', 'Umuahia', 'Ohafia', 'Arochukwu'],
  'Adamawa': ['Yola', 'Mubi', 'Jimeta', 'Numan'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron'],
  'Anambra': ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia'],
  'Bauchi': ['Bauchi', 'Azare', 'Misau', 'Jama\'are'],
  'Bayelsa': ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama'],
  'Benue': ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala'],
  'Borno': ['Maiduguri', 'Biu', 'Bama', 'Dikwa'],
  'Cross River': ['Calabar', 'Ugep', 'Ogoja', 'Ikom'],
  'Delta': ['Asaba', 'Warri', 'Sapele', 'Ughelli'],
  'Ebonyi': ['Abakaliki', 'Afikpo', 'Onueke', 'Ezza'],
  'Edo': ['Benin City', 'Auchi', 'Ekpoma', 'Uromi'],
  'Ekiti': ['Ado-Ekiti', 'Ikere', 'Ijero', 'Ikole'],
  'Enugu': ['Enugu', 'Nsukka', 'Agbani', 'Oji River'],
  'FCT': ['Abuja', 'Gwagwalada', 'Kuje', 'Bwari'],
  'Gombe': ['Gombe', 'Kumo', 'Deba', 'Billiri'],
  'Imo': ['Owerri', 'Orlu', 'Okigwe', 'Mbaise'],
  'Jigawa': ['Dutse', 'Hadejia', 'Gumel', 'Kazaure'],
  'Kaduna': ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro'],
  'Kano': ['Kano', 'Wudil', 'Bichi', 'Gwarzo'],
  'Katsina': ['Katsina', 'Daura', 'Funtua', 'Malumfashi'],
  'Kebbi': ['Birnin Kebbi', 'Argungu', 'Zuru', 'Yauri'],
  'Kogi': ['Lokoja', 'Okene', 'Kabba', 'Idah'],
  'Kwara': ['Ilorin', 'Offa', 'Jebba', 'Lafiagi'],
  'Lagos': ['Ikeja', 'Lagos Island', 'Lekki', 'Ikorodu', 'Epe', 'Badagry', 'Victoria Island', 'Yaba', 'Surulere', 'Ajah'],
  'Nasarawa': ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa'],
  'Niger': ['Minna', 'Bida', 'Kontagora', 'Suleja'],
  'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota'],
  'Ondo': ['Akure', 'Ondo', 'Owo', 'Ikare'],
  'Osun': ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede'],
  'Oyo': ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin'],
  'Plateau': ['Jos', 'Bukuru', 'Pankshin', 'Shendam'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme'],
  'Sokoto': ['Sokoto', 'Tambuwal', 'Gwadabawa', 'Wurno'],
  'Taraba': ['Jalingo', 'Wukari', 'Bali', 'Ibi'],
  'Yobe': ['Damaturu', 'Potiskum', 'Gashua', 'Nguru'],
  'Zamfara': ['Gusau', 'Kaura Namoda', 'Anka', 'Talata Mafara']
};

const emptyFormData = () => ({
  name: '',
  description: '',
  category: '',
  subCategory: '',
  price: '',
  duration: 30,
  durationUnit: 'minutes',
  yearsOfExperience: '',
  homeServiceAvailable: false,
  availability: DAYS.map(day => ({
    day,
    isAvailable: true,
    openingTime: '09:00',
    closingTime: '18:00'
  })),
  timeSlotDuration: 30,
  maxBookingsPerDay: '',
  serviceLocations: {
    coverAllNigeria: false,
    states: []
  },
  portfolioImages: [], // Store preview URLs for NEWLY added files only
  addOns: []
});

// `existingService` is one item from the vendor's own services list
// (services/page.js), not the whole { services: [...] } document -- passed
// only when editing. When set, the form is prefilled and handleSubmit PATCHes
// that item's id instead of POSTing a new one.
export default function AddServiceModal({ isOpen, onClose, onSaved, existingService }) {
  const { secureFormDataCall } = useAuth();
  const isEditing = !!existingService?._id;
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedStateForCity, setSelectedStateForCity] = useState('');
  const [portfolioFiles, setPortfolioFiles] = useState([]); // Store actual File objects
  // Portfolio URLs already on the server for this item -- kept separate
  // from `formData.portfolioImages` (new blob previews) so an edit can
  // distinguish "keep this one" from "here's a new file to upload", and so
  // removing one doesn't try to URL.revokeObjectURL() a real remote URL.
  const [existingPortfolioUrls, setExistingPortfolioUrls] = useState(
    isEditing ? (existingService.portfolioImages || []) : []
  );

  const [formData, setFormData] = useState(() => {
    if (!isEditing) return emptyFormData();
    return {
      name: existingService.name || '',
      description: existingService.description || '',
      category: existingService.category || '',
      subCategory: existingService.subCategory || '',
      price: existingService.price?.toString() ?? '',
      duration: existingService.duration || 30,
      durationUnit: existingService.durationUnit || 'minutes',
      yearsOfExperience: existingService.yearsOfExperience?.toString() ?? '',
      homeServiceAvailable: !!existingService.homeServiceAvailable,
      availability: DAYS.map(day => {
        const existing = (existingService.availability || []).find(a => a.day === day);
        return existing || { day, isAvailable: true, openingTime: '09:00', closingTime: '18:00' };
      }),
      timeSlotDuration: existingService.timeSlotDuration || 30,
      maxBookingsPerDay: existingService.maxBookingsPerDay?.toString() ?? '',
      serviceLocations: existingService.serviceLocations || { coverAllNigeria: false, states: [] },
      portfolioImages: [],
      addOns: existingService.addOns || []
    };
  });

  // Duration options based on selected unit
  const getDurationOptions = () => {
    switch (formData.durationUnit) {
      case 'minutes':
        return [
          { value: 15, label: '15 minutes' },
          { value: 30, label: '30 minutes' },
          { value: 45, label: '45 minutes' }
        ];
      case 'hours':
        return [
          { value: 60, label: '1 hour' },
          { value: 90, label: '1.5 hours' },
          { value: 120, label: '2 hours' },
          { value: 180, label: '3 hours' },
          { value: 240, label: '4 hours' },
          { value: 300, label: '5 hours' },
          { value: 360, label: '6 hours' },
          { value: 480, label: '8 hours' }
        ];
      case 'days':
        return [
          { value: 1440, label: '1 day' },
          { value: 2880, label: '2 days' },
          { value: 4320, label: '3 days' },
          { value: 5760, label: '4 days' },
          { value: 7200, label: '5 days' },
          { value: 8640, label: '6 days' }
        ];
      default:
        return [];
    }
  };

  const handleDurationUnitChange = (unit) => {
    setFormData(prev => ({
      ...prev,
      durationUnit: unit,
      duration: unit === 'minutes' ? 30 :
                unit === 'hours' ? 60 : 1440
    }));
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Handle numeric input validation
  const handleNumericInput = (field, value) => {
    // Remove any non-numeric characters except decimal point
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    const cleanValue = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : numericValue;
    
    handleInputChange(field, cleanValue);
  };

  const handlePortfolioUpload = (e) => {
    const files = Array.from(e.target.files);
    const totalAfter = existingPortfolioUrls.length + portfolioFiles.length + files.length;
    if (totalAfter > 5) {
      alert('Maximum 5 images per service');
      return;
    }

    // Store actual files
    setPortfolioFiles(prev => [...prev, ...files]);

    // Create preview URLs
    const newImages = files.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      portfolioImages: [...prev.portfolioImages, ...newImages]
    }));
  };

  const removePortfolioImage = (index) => {
    // Revoke the blob URL to free memory
    URL.revokeObjectURL(formData.portfolioImages[index]);

    setPortfolioFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      portfolioImages: prev.portfolioImages.filter((_, i) => i !== index)
    }));
  };

  // Removes an already-uploaded image (edit mode only) -- distinct from
  // removePortfolioImage above, which only ever handled newly-picked blob
  // previews. No URL.revokeObjectURL here since this is a real remote URL,
  // not a local blob.
  const removeExistingPortfolioImage = (index) => {
    setExistingPortfolioUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Property is `state` (not `stateName`) so this matches both the DB
  // column (service_locations.state) and what items/route.js sends/reads
  // and loadServiceDocument (services.js) reshapes back -- previously this
  // was `stateName`, a field name the API never read, so every location a
  // vendor picked here was silently written as NULL and lost on save.
  const addState = () => {
    if (!selectedStateForCity) return;

    const stateExists = formData.serviceLocations.states.some(
      entry => entry.state === selectedStateForCity
    );

    if (stateExists) {
      alert('This state is already added');
      return;
    }

    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: [
          ...prev.serviceLocations.states,
          {
            state: selectedStateForCity,
            cities: [],
            coverAllCities: false
          }
        ]
      }
    }));
    setSelectedStateForCity('');
  };

  const removeState = (stateValue) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.filter(entry => entry.state !== stateValue)
      }
    }));
  };

  const toggleCoverAllCities = (stateValue) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(entry =>
          entry.state === stateValue
            ? { ...entry, coverAllCities: !entry.coverAllCities, cities: [] }
            : entry
        )
      }
    }));
  };

  const addCityToState = (stateValue, city) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(entry =>
          entry.state === stateValue
            ? {
                ...entry,
                cities: entry.cities.includes(city)
                  ? entry.cities
                  : [...entry.cities, city]
              }
            : entry
        )
      }
    }));
  };

  const removeCityFromState = (stateValue, city) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(entry =>
          entry.state === stateValue
            ? { ...entry, cities: entry.cities.filter(c => c !== city) }
            : entry
        )
      }
    }));
  };

  const addAddOn = () => {
    setFormData(prev => ({ ...prev, addOns: [...prev.addOns, { name: '', price: '' }] }));
  };

  const updateAddOn = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      addOns: prev.addOns.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    }));
  };

  const removeAddOn = (index) => {
    setFormData(prev => ({ ...prev, addOns: prev.addOns.filter((_, i) => i !== index) }));
  };

  // Returns an error string, or null if this step is complete -- shared by
  // nextStep (so a vendor can't click through with empty required fields,
  // previously possible since nextStep did no validation at all) and
  // handleSubmit's own final re-check before submitting.
  const validateStep = (step) => {
    if (step === 1) {
      if (!formData.name.trim()) return 'Service name is required';
      if (!formData.description.trim()) return 'Service description is required';
      if (!formData.category) return 'Please select a category';
      if (!formData.subCategory) return 'Please select a sub-category';
      if (!formData.price || Number(formData.price) <= 0) return 'Please enter a valid price';
    }
    if (step === 2) {
      if (!formData.serviceLocations.coverAllNigeria && formData.serviceLocations.states.length === 0) {
        return 'Please select at least one service location, or choose nationwide';
      }
    }
    if (step === 3) {
      if (!formData.maxBookingsPerDay || Number(formData.maxBookingsPerDay) <= 0) {
        return 'Please enter how many bookings you can take per day';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    for (let step = 1; step <= STEPS.length; step++) {
      const stepError = validateStep(step);
      if (stepError) {
        alert(stepError);
        setCurrentStep(step);
        return;
      }
    }

    setLoading(true);
    try {
      // Create FormData for multipart upload
      const submitFormData = new FormData();

      // Convert form data to proper types
      const serviceItemData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        yearsOfExperience: parseInt(formData.yearsOfExperience) || 0,
        maxBookingsPerDay: parseInt(formData.maxBookingsPerDay) || 10,
        addOns: formData.addOns.filter(a => a.name?.trim()),
        portfolioImages: [] // Will be filled by backend after upload
      };

      // Remove portfolioImages from the data (they'll be uploaded separately)
      delete serviceItemData.portfolioImages;

      submitFormData.append('serviceItem', JSON.stringify(serviceItemData));
      if (isEditing) {
        submitFormData.append('existingPortfolioImages', JSON.stringify(existingPortfolioUrls));
      }
      // Don't send storeId - backend will fetch it from the user's store

      // Append portfolio image files
      portfolioFiles.forEach((file) => {
        submitFormData.append('portfolioImages', file);
      });

      const endpoint = isEditing ? `/api/services/items/${existingService._id}` : '/api/services/items';
      const data = isEditing
        ? await secureFormDataCall(endpoint, submitFormData, { method: 'PATCH' })
        : await secureFormDataCall(endpoint, submitFormData);

      if (data.success) {
        // Clean up blob URLs
        formData.portfolioImages.forEach(url => URL.revokeObjectURL(url));

        onSaved?.(data.data);
        onClose();
      } else {
        alert(data.error || data.message || `Failed to ${isEditing ? 'update' : 'add'} service`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || `Failed to ${isEditing ? 'update' : 'add'} service`);
    } finally {
      setLoading(false);
    }
  };

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      formData.portfolioImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const nextStep = () => {
    const stepError = validateStep(currentStep);
    if (stepError) {
      alert(stepError);
      return;
    }
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">{isEditing ? 'Edit Service' : 'Add New Service'}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isEditing ? 'Update the details of this service' : 'Add a new service to your offerings'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep >= step.id ? 'bg-brand-800 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step.id}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 ${
                    currentStep > step.id ? 'bg-brand-800' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto">
          {/* Step 1: Service Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Haircut & Styling"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (₦) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.price}
                    onChange={(e) => handleNumericInput('price', e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select category' },
                      ...CATEGORIES.map(cat => ({ value: cat.value, label: cat.label }))
                    ]}
                    value={formData.category}
                    onChange={(value) => {
                      handleInputChange('category', value);
                      handleInputChange('subCategory', '');
                    }}
                    placeholder="Select category"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Category *</label>
                  <CustomDropdown
                    options={[
                      { value: '', label: 'Select sub-category' },
                      ...(formData.category && SUB_CATEGORIES[formData.category]
                        ? SUB_CATEGORIES[formData.category].map(sub => ({ value: sub, label: sub }))
                        : [])
                    ]}
                    value={formData.subCategory}
                    onChange={(value) => handleInputChange('subCategory', value)}
                    placeholder="Select sub-category"
                    disabled={!formData.category}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows="3"
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                  placeholder="Describe what this service includes..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Duration *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <CustomDropdown
                      options={[
                        { value: 'minutes', label: 'Minutes' },
                        { value: 'hours', label: 'Hours' },
                        { value: 'days', label: 'Days' }
                      ]}
                      value={formData.durationUnit}
                      onChange={handleDurationUnitChange}
                      placeholder="Unit"
                    />
                    <CustomDropdown
                      options={getDurationOptions()}
                      value={formData.duration}
                      onChange={(value) => handleInputChange('duration', value)}
                      placeholder="Duration"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.yearsOfExperience}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      handleInputChange('yearsOfExperience', value);
                    }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                  />
                </div>
              </div>

              {/* Same bg-brand-50/border-brand-100 treatment as the "Where
                  can customers book this service?" callout in Step 2 --
                  every info callout in this form reads as one consistent
                  style now, rather than each section picking its own color. */}
              <div className="p-6 bg-brand-50 rounded-xl border-2 border-brand-100">
                <label className="flex items-start space-x-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.homeServiceAvailable}
                    onChange={(e) => handleInputChange('homeServiceAvailable', e.target.checked)}
                    className="w-5 h-5 text-brand-800 rounded focus:ring-brand-800 mt-1 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-base font-semibold text-gray-900">Do you offer home service?</span>
                      <span className="ml-2 px-2 py-0.5 bg-brand-100 text-brand-800 text-xs font-medium rounded-full">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Check this box if you can go to the customer&apos;s location to provide this service. This gives customers more flexibility in how they book.
                    </p>
                    {formData.homeServiceAvailable && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-brand-200">
                        <p className="text-xs text-brand-800 font-medium">
                          ✓ Home service enabled for this service
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Built fully at the schema/API/reshape layers for a while
                  with no UI to actually create one -- a vendor could never
                  add an add-on before this. */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Add-ons (Optional)</label>
                  <button
                    type="button"
                    onClick={addAddOn}
                    className="text-sm font-medium text-brand-800 hover:text-brand-900"
                  >
                    + Add an add-on
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Extras a customer can add on top of this service, e.g. &quot;Extra hour&quot; or &quot;Rush delivery&quot;.
                </p>
                {formData.addOns.length > 0 && (
                  <div className="space-y-2">
                    {formData.addOns.map((addOn, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={addOn.name}
                          onChange={(e) => updateAddOn(index, 'name', e.target.value)}
                          placeholder="Add-on name"
                          className="flex-1 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={addOn.price}
                          onChange={(e) => updateAddOn(index, 'price', e.target.value.replace(/[^\d.]/g, ''))}
                          placeholder="Price (₦)"
                          className="w-32 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeAddOn(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Service Location */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-brand-50 rounded-xl mb-4 border border-brand-100">
                <p className="text-sm text-brand-900">
                  <strong>Where can customers book this service?</strong> Select the states and cities where you provide this specific service.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.serviceLocations.coverAllNigeria}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        serviceLocations: {
                          coverAllNigeria: checked,
                          states: checked ? [] : prev.serviceLocations.states
                        }
                      }));
                    }}
                    className="w-4 h-4 text-brand-800 rounded focus:ring-brand-800"
                  />
                  <span className="font-medium text-gray-900">Available nationwide</span>
                </label>
              </div>

              {!formData.serviceLocations.coverAllNigeria && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add States</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <CustomDropdown
                          options={[
                            { value: '', label: 'Select a state' },
                            ...Object.keys(NIGERIAN_STATES).map(state => ({
                              value: state,
                              label: state
                            }))
                          ]}
                          value={selectedStateForCity}
                          onChange={setSelectedStateForCity}
                          placeholder="Select state"
                        />
                      </div>
                      <button
                        onClick={addState}
                        disabled={!selectedStateForCity}
                        className="px-4 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add State
                      </button>
                    </div>
                  </div>

                  {formData.serviceLocations.states.length > 0 && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Selected States & Cities</label>
                      {formData.serviceLocations.states.map((entry) => (
                        <div key={entry.state} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">{entry.state}</h4>
                            <button
                              onClick={() => removeState(entry.state)}
                              className="text-red-500 hover:text-red-600 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mb-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entry.coverAllCities}
                                onChange={() => toggleCoverAllCities(entry.state)}
                                className="w-4 h-4 text-brand-800 rounded focus:ring-brand-800"
                              />
                              <span className="text-sm text-gray-700">All cities in {entry.state}</span>
                            </label>
                          </div>

                          {!entry.coverAllCities && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Select Cities</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                {NIGERIAN_STATES[entry.state]?.map((city) => (
                                  <label
                                    key={city}
                                    className="flex items-center space-x-2 cursor-pointer text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={entry.cities.includes(city)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          addCityToState(entry.state, city);
                                        } else {
                                          removeCityFromState(entry.state, city);
                                        }
                                      }}
                                      className="w-3 h-3 text-brand-800 rounded focus:ring-brand-800"
                                    />
                                    <span className="text-gray-700">{city}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Availability */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Slot Duration</label>
                  <CustomDropdown
                    options={[
                      { value: 15, label: '15 minutes' },
                      { value: 30, label: '30 minutes' },
                      { value: 45, label: '45 minutes' },
                      { value: 60, label: '1 hour' }
                    ]}
                    value={formData.timeSlotDuration}
                    onChange={(value) => handleInputChange('timeSlotDuration', value)}
                    placeholder="Select time slot"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Bookings Per Day *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.maxBookingsPerDay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      handleInputChange('maxBookingsPerDay', value);
                    }}
                    placeholder="10"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Service Hours</label>
                {formData.availability.map((day, index) => (
                  <div key={day.day} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={day.isAvailable}
                          onChange={(e) => {
                            const newAvailability = [...formData.availability];
                            newAvailability[index].isAvailable = e.target.checked;
                            setFormData(prev => ({ ...prev, availability: newAvailability }));
                          }}
                          className="w-4 h-4 text-brand-800 rounded focus:ring-brand-800"
                        />
                        <span className="font-medium text-gray-900 capitalize">{day.day}</span>
                      </label>
                    </div>

                    {day.isAvailable && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Opening Time</label>
                          <input
                            type="time"
                            value={day.openingTime}
                            onChange={(e) => {
                              const newAvailability = [...formData.availability];
                              newAvailability[index].openingTime = e.target.value;
                              setFormData(prev => ({ ...prev, availability: newAvailability }));
                            }}
                            className="w-full px-3 py-2 bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Closing Time</label>
                          <input
                            type="time"
                            value={day.closingTime}
                            onChange={(e) => {
                              const newAvailability = [...formData.availability];
                              newAvailability[index].closingTime = e.target.value;
                              setFormData(prev => ({ ...prev, availability: newAvailability }));
                            }}
                            className="w-full px-3 py-2 bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-gray-900 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Portfolio */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Images (Max 5)
                </label>
                <p className="text-xs text-gray-500 mb-3">Upload images showcasing this specific service</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {existingPortfolioUrls.map((img, index) => (
                    <div key={`existing-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeExistingPortfolioImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {formData.portfolioImages.map((img, index) => (
                    <div key={`new-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePortfolioImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {existingPortfolioUrls.length + formData.portfolioImages.length < 5 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-800 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePortfolioUpload}
                        className="hidden"
                      />
                      <Upload className="w-6 h-6 text-gray-400" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-colors ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            {currentStep < STEPS.length ? (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 px-6 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors disabled:opacity-50"
              >
                {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Service')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
