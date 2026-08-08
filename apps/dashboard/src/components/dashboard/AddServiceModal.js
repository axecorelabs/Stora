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

export default function AddServiceModal({ isOpen, onClose, storeData, existingService }) {
  const { secureFormDataCall } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedStateForCity, setSelectedStateForCity] = useState('');
  const [portfolioFiles, setPortfolioFiles] = useState([]); // Store actual File objects
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    subCategory: '',
    price: '',
    duration: 30,
    durationUnit: 'minutes',
    yearsOfExperience: '',
    homeServiceAvailable: false,
    discount: '',
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
    portfolioImages: [], // Store preview URLs
    addOns: []
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
      case 'weeks':
        return [
          { value: 10080, label: '1 week' },
          { value: 20160, label: '2 weeks' },
          { value: 30240, label: '3 weeks' },
          { value: 40320, label: '4 weeks' }
        ];
      default:
        return [];
    }
  };

  const handleDurationUnitChange = (unit) => {
    // Reset duration to first option when unit changes
    const options = getDurationOptions();
    const firstOption = options.length > 0 ? options[0].value : 30;
    
    setFormData(prev => ({
      ...prev,
      durationUnit: unit,
      duration: unit === 'minutes' ? 30 :
                unit === 'hours' ? 60 :
                unit === 'days' ? 1440 : 10080
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

  // Handle integer input validation (for discount)
  const handleIntegerInput = (field, value) => {
    // Remove any non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    handleInputChange(field, numericValue);
  };

  const handlePortfolioUpload = (e) => {
    const files = Array.from(e.target.files);
    if (portfolioFiles.length + files.length > 5) {
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

  const addState = () => {
    if (!selectedStateForCity) return;
    
    const stateExists = formData.serviceLocations.states.some(
      s => s.stateName === selectedStateForCity
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
            stateName: selectedStateForCity,
            cities: [],
            coverAllCities: false
          }
        ]
      }
    }));
    setSelectedStateForCity('');
  };

  const removeState = (stateName) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.filter(s => s.stateName !== stateName)
      }
    }));
  };

  const toggleCoverAllCities = (stateName) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(state => 
          state.stateName === stateName
            ? { ...state, coverAllCities: !state.coverAllCities, cities: [] }
            : state
        )
      }
    }));
  };

  const addCityToState = (stateName, city) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(state => 
          state.stateName === stateName
            ? {
                ...state,
                cities: state.cities.includes(city)
                  ? state.cities
                  : [...state.cities, city]
              }
            : state
        )
      }
    }));
  };

  const removeCityFromState = (stateName, city) => {
    setFormData(prev => ({
      ...prev,
      serviceLocations: {
        ...prev.serviceLocations,
        states: prev.serviceLocations.states.map(state => 
          state.stateName === stateName
            ? { ...state, cities: state.cities.filter(c => c !== city) }
            : state
        )
      }
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.description || !formData.category || !formData.subCategory || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.serviceLocations.coverAllNigeria && formData.serviceLocations.states.length === 0) {
      alert('Please select service locations');
      return;
    }

    setLoading(true);
    try {
      // Create FormData for multipart upload
      const submitFormData = new FormData();
      
      // Convert form data to proper types
      const serviceItemData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        discount: parseInt(formData.discount) || 0,
        yearsOfExperience: parseInt(formData.yearsOfExperience) || 0,
        maxBookingsPerDay: parseInt(formData.maxBookingsPerDay) || 10,
        portfolioImages: [] // Will be filled by backend after upload
      };
      
      // Remove portfolioImages from the data (they'll be uploaded separately)
      delete serviceItemData.portfolioImages;
      
      submitFormData.append('serviceItem', JSON.stringify(serviceItemData));
      // Don't send storeId - backend will fetch it from the user's store
      
      // Append portfolio image files
      portfolioFiles.forEach((file, index) => {
        submitFormData.append('portfolioImages', file);
      });

      const data = await secureFormDataCall('/api/services/items', submitFormData);

      if (data.success) {
        alert('Service added successfully!');
        
        // Clean up blob URLs
        formData.portfolioImages.forEach(url => URL.revokeObjectURL(url));
        
        onClose();
        window.location.reload();
      } else {
        alert(data.error || data.message || 'Failed to add service');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to add service');
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
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Add New Service</h3>
              <p className="text-sm text-gray-500 mt-1">Add a new service to your offerings</p>
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
                    currentStep >= step.id ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
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
                    currentStep > step.id ? 'bg-teal-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Service Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Haircut & Styling"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
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
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                  placeholder="Describe what this service includes..."
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Duration *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <CustomDropdown
                      options={[
                        { value: 'minutes', label: 'Minutes' },
                        { value: 'hours', label: 'Hours' },
                        { value: 'days', label: 'Days' },
                        { value: 'weeks', label: 'Weeks' }
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.discount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const numValue = parseInt(value) || '';
                      if (numValue === '' || numValue <= 100) {
                        handleInputChange('discount', value);
                      }
                    }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                  />
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
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border-2 border-teal-200">
                <label className="flex items-start space-x-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.homeServiceAvailable}
                    onChange={(e) => handleInputChange('homeServiceAvailable', e.target.checked)}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 mt-1 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-base font-semibold text-gray-900">Do you offer home service?</span>
                      <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                        Optional
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Check this box if you can go to the customer's location to provide this service. This gives customers more flexibility in how they book.
                    </p>
                    {formData.homeServiceAvailable && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-teal-200">
                        <p className="text-xs text-teal-700 font-medium">
                          ✓ Home service enabled for this service
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Service Location */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl mb-4">
                <p className="text-sm text-blue-800">
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
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
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
                        className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add State
                      </button>
                    </div>
                  </div>

                  {formData.serviceLocations.states.length > 0 && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Selected States & Cities</label>
                      {formData.serviceLocations.states.map((state) => (
                        <div key={state.stateName} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">{state.stateName}</h4>
                            <button
                              onClick={() => removeState(state.stateName)}
                              className="text-red-500 hover:text-red-600 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mb-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={state.coverAllCities}
                                onChange={() => toggleCoverAllCities(state.stateName)}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                              />
                              <span className="text-sm text-gray-700">All cities in {state.stateName}</span>
                            </label>
                          </div>

                          {!state.coverAllCities && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Select Cities</label>
                              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                {NIGERIAN_STATES[state.stateName]?.map((city) => (
                                  <label
                                    key={city}
                                    className="flex items-center space-x-2 cursor-pointer text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={state.cities.includes(city)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          addCityToState(state.stateName, city);
                                        } else {
                                          removeCityFromState(state.stateName, city);
                                        }
                                      }}
                                      className="w-3 h-3 text-teal-600 rounded focus:ring-teal-500"
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
              <div className="grid grid-cols-2 gap-4 mb-4">
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
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
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
                          className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                        />
                        <span className="font-medium text-gray-900 capitalize">{day.day}</span>
                      </label>
                    </div>

                    {day.isAvailable && (
                      <div className="grid grid-cols-2 gap-3">
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
                            className="w-full px-3 py-2 bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 text-sm"
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
                            className="w-full px-3 py-2 bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 text-sm"
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
                <div className="grid grid-cols-4 gap-3">
                  {formData.portfolioImages.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePortfolioImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {formData.portfolioImages.length < 5 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-teal-500 transition-colors">
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
        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
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
                className="flex items-center space-x-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Service'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
