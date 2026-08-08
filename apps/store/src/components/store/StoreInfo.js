export default function StoreInfo({ store }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* About Section */}
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">About {store.storeName}</h2>
        <p className="text-gray-600 leading-relaxed mb-6">
          {store.storeDescription || `Welcome to ${store.storeName}! We're passionate about providing quality products and excellent customer service.`}
        </p>
        
        {/* Store Type Badge */}
        <div className="flex items-center space-x-2 mb-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            store.storeType === 'physical' 
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }`}>
            {store.storeType === 'physical' ? '🏪 Physical Store' : '🌐 Online Store'}
          </span>
        </div>
      </div>
      
      {/* Location (for physical stores) */}
      {store.storeType === 'physical' && store.fullAddress && (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">📍 Location</h3>
          <p className="text-gray-600">{store.fullAddress}</p>
        </div>
      )}
      
      {/* Social Media Links */}
      {store.onlineStoreInfo?.socialMedia && (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Connect With Us</h3>
          <div className="flex space-x-4">
            {Object.entries(store.onlineStoreInfo.socialMedia).map(([platform, url]) => {
              if (!url) return null;
              
              const icons = {
                instagram: '📷',
                facebook: '👤',
                twitter: '🐦',
                whatsapp: '💬'
              };
              
              return (
                <a
                  key={platform}
                  href={platform === 'whatsapp' ? `https://wa.me/${url}` : url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span className="text-xl">{icons[platform]}</span>
                  <span className="capitalize">{platform}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
