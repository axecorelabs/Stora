'use client';
import { useState } from 'react';

export default function StoreContact({ store }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle contact form submission
    const whatsappMessage = `Hi ${store.storeName}! My name is ${formData.name} (${formData.email}). ${formData.message}`;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    
    if (store.onlineStoreInfo?.socialMedia?.whatsapp) {
      window.open(`https://wa.me/${store.onlineStoreInfo.socialMedia.whatsapp}?text=${encodedMessage}`, '_blank');
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Contact Form */}
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                required
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Send Message via WhatsApp
            </button>
          </form>
        </div>
        
        {/* Contact Information */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h3>
            
            {store.storePhone && (
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-blue-600">📞</span>
                <span className="text-gray-600">{store.storePhone}</span>
              </div>
            )}
            
            {store.storeEmail && (
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-blue-600">✉️</span>
                <span className="text-gray-600">{store.storeEmail}</span>
              </div>
            )}
            
            {store.storeType === 'physical' && store.fullAddress && (
              <div className="flex items-start space-x-3">
                <span className="text-blue-600 mt-1">📍</span>
                <span className="text-gray-600">{store.fullAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
