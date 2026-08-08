"use client";
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Upload, Trash2 } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useAuth } from "@/contexts/AuthContext";

const STEPS = [
  { id: 1, title: "Business Info", description: "About your business" },
  { id: 2, title: "Availability", description: "When you work" }
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function BusinessSetupModal({ isOpen, onClose, storeData }) {
  const { secureApiCall } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessDescription: '',
    yearsOfExperience: 0,
    portfolioImages: [],
    availability: DAYS.map(day => ({
      day,
      isAvailable: true,
      openingTime: '09:00',
      closingTime: '18:00',
      breakTime: { start: '', end: '' }
    })),
    timeSlotDuration: 30,
    maxBookingsPerDay: 10,
    storeId: ''
  });

  useEffect(() => {
    if (storeData) {
      setFormData(prev => ({
        ...prev,
        storeId: storeData._id || ''
      }));
    }
  }, [storeData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePortfolioUpload = (e) => {
    const files = Array.from(e.target.files);
    if (formData.portfolioImages.length + files.length > 10) {
      alert('Maximum 10 portfolio images allowed');
      return;
    }
    const newImages = files.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      portfolioImages: [...prev.portfolioImages, ...newImages]
    }));
  };

  const removePortfolioImage = (index) => {
    setFormData(prev => ({
      ...prev,
      portfolioImages: prev.portfolioImages.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.businessDescription) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const data = await secureApiCall('/api/services/setup', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (data.success) {
        alert('Business setup completed successfully!');
        onClose();
        window.location.reload();
      } else {
        alert(data.error || data.message || 'Failed to setup business');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to setup business');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Business Setup</h3>
              <p className="text-sm text-gray-500 mt-1">Complete your business profile to start adding services</p>
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
          {/* Step 1: Business Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Description *</label>
                <textarea
                  value={formData.businessDescription}
                  onChange={(e) => handleInputChange('businessDescription', e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                  placeholder="Tell customers about your business..."
                  required
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
                    handleInputChange('yearsOfExperience', value ? parseInt(value) : 0);
                  }}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Portfolio Images (Max 10)
                </label>
                <div className="grid grid-cols-5 gap-3">
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
                  {formData.portfolioImages.length < 10 && (
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

          {/* Step 2: Availability */}
          {currentStep === 2 && (
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Bookings Per Day</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.maxBookingsPerDay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      handleInputChange('maxBookingsPerDay', value ? parseInt(value) : 1);
                    }}
                    placeholder="10"
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-3">
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
              className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
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
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
