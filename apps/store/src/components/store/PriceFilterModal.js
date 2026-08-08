'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function PriceFilterModal({ isOpen, onClose, priceRanges, selectedPrice, onSelect }) {
  useEffect(() => {
    if (isOpen) {
      console.log('PriceFilterModal: isOpen =', isOpen);
      console.log('PriceFilterModal: priceRanges =', priceRanges);
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
          <h3 className="text-xl font-semibold text-gray-900">Filter by Price</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {priceRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => {
                onSelect(range.value);
                onClose();
              }}
              className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-colors ${
                selectedPrice === range.value ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
