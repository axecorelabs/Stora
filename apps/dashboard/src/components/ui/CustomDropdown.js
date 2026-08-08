'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SIZE_STYLES = {
  md: { button: 'px-4 py-3', icon: 'w-4 h-4', option: 'px-4 py-3' },
  sm: { button: 'px-3 py-1.5 text-xs', icon: 'w-3.5 h-3.5', option: 'px-3 py-1.5 text-xs' }
};

export default function CustomDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  error = false,
  size = 'md',
  menuPlacement = 'bottom'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full ${sizeStyle.button} text-left border rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-transparent ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-gray-50'
        } ${
          error
            ? 'border-red-300'
            : 'border-gray-300'
        } bg-white text-black`}
      >
        <div className="flex items-center justify-between">
          <span className={selectedOption ? 'text-black' : 'text-gray-500'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={`${sizeStyle.icon} transition-transform text-gray-500 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto ${
          menuPlacement === 'top' ? 'bottom-full mb-1' : 'mt-1'
        }`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option)}
              className={`w-full ${sizeStyle.option} text-left transition-colors text-black ${
                value === option.value
                  ? 'bg-brand-50 text-brand-800'
                  : 'hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
