'use client';
import { useState } from 'react';
import SignUpModal from './auth/SignUpModal';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  const handleSignUpSuccess = (customer) => {
    console.log('Customer registered successfully:', customer);
    // Handle successful registration (e.g., show success message, redirect, etc.)
  };

  return (
    <>
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">I</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">IVMA Store</h1>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#home" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Home
              </a>
              <a href="#marketplace" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Marketplace
              </a>
              <a href="#sellers" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                For Sellers
              </a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                About
              </a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Contact
              </a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Log in
              </button>
              <button 
                onClick={() => setShowSignUpModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign Up
              </button>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-6 py-4 space-y-3">
              <a href="#home" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">Home</a>
              <a href="#marketplace" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">Marketplace</a>
              <a href="#sellers" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">For Sellers</a>
              <a href="#about" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">About</a>
              <a href="#contact" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">Contact</a>
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <button className="block w-full text-left text-gray-600 hover:text-gray-900 text-sm font-medium">Log in</button>
                <button className="block w-full text-left bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Start Selling</button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <SignUpModal 
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onSuccess={handleSignUpSuccess}
      />
    </>
  );
}
