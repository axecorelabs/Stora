'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function CategoryFilterModal({ isOpen, onClose, categories, selectedCategory, onSelect }) {
  useEffect(() => {
    if (isOpen) {
      console.log('CategoryFilterModal: isOpen =', isOpen);
      console.log('CategoryFilterModal: categories =', categories);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
      onClick={onClose}
      style={{ isolation: 'isolate' }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-900">Filter by Category</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => {
                onSelect(category.value);
                onClose();
              }}
              className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-colors ${
                selectedCategory === category.value ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
