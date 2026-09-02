'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const SIZE_STYLES = {
  md: { button: 'px-4 py-3', icon: 'w-4 h-4', option: 'px-4 py-3' },
  sm: { button: 'px-3 py-1.5 text-xs', icon: 'w-3.5 h-3.5', option: 'px-3 py-1.5 text-xs' }
};

// Small colored circle shown before an option's label when it carries a
// `swatch` (a hex color or any valid CSS `background` value, e.g. the
// Multicolor gradient in productColors.js) -- lets a long color list be
// scanned visually instead of read word by word. Unused options (no
// `swatch`) render with no dot, so this is a no-op for every other
// CustomDropdown usage in the app.
function OptionSwatch({ swatch }) {
  if (!swatch) return null;
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
      style={{ background: swatch }}
    />
  );
}

export default function CustomDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  error = false,
  size = 'md',
  menuPlacement = 'bottom',
  // Adds a filter input at the top of the open menu -- worth it once a
  // list runs past a couple dozen options (e.g. the color-tag dropdown's
  // 100+ colors), noise for every short list, so it's opt-in.
  searchable = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus the filter input when the menu opens -- the reset-on-close half
  // of this used to live in the same effect (an else branch calling
  // setSearchTerm), but that's a direct setState-in-effect; it's done at
  // each actual close site instead (here, handleClickOutside above,
  // handleSelect and the toggle button below).
  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find(option => option.value === value);

  const visibleOptions = searchable && searchTerm.trim()
    ? options.filter(option => option.label.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : options;

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      if (prev) setSearchTerm('');
      return !prev;
    });
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
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
        <div className="flex items-center justify-between gap-1.5">
          <span className={`flex items-center gap-1.5 truncate min-w-0 ${selectedOption ? 'text-black' : 'text-gray-500'}`}>
            <OptionSwatch swatch={selectedOption?.swatch} />
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          </span>
          <ChevronDown className={`${sizeStyle.icon} flex-shrink-0 transition-transform text-gray-500 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 flex flex-col ${
          menuPlacement === 'top' ? 'bottom-full mb-1' : 'mt-1'
        }`}>
          {searchable && (
            <div className="p-2 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-black"
                />
              </div>
            </div>
          )}
          <div className="overflow-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500">No matches found</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full ${sizeStyle.option} flex items-center gap-2 text-left transition-colors text-black ${
                    value === option.value
                      ? 'bg-brand-50 text-brand-800'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <OptionSwatch swatch={option.swatch} />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
