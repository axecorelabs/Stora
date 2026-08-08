export default function StoreNavigation({ activeSection, setActiveSection, settings }) {
  const categories = [
    'All Products',
    'Electronics', 
    'Clothing',
    'Home & Garden',
    'Beauty',
    'Sports',
    'Books',
    'Toys'
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-6 overflow-x-auto scrollbar-hide py-4">
          {categories.map((category, index) => (
            <button
              key={category}
              onClick={() => setActiveSection('products')}
              className={`text-gray-700 hover:text-emerald-600 whitespace-nowrap text-sm font-medium transition-colors pb-1 ${
                index === 0 ? 'text-emerald-600 border-b-2 border-emerald-600' : ''
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
