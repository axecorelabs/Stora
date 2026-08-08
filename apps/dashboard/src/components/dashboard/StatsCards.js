export default function StatsCards() {
  const stats = [
    {
      title: 'Total Items',
      description: 'Total items in stock',
      value: '120',
      icon: '📦',
      iconBg: 'bg-teal-100',
      iconColor: 'bg-teal-500'
    },
    {
      title: 'Low Stock Items',
      description: 'Number of items that are running low',
      value: '8',
      icon: '⚠️',
      iconBg: 'bg-orange-100',
      iconColor: 'bg-orange-500'
    },
    {
      title: 'Expired Items',
      description: 'Number of items past their expiration date',
      value: '40',
      icon: '⚠️',
      iconBg: 'bg-red-100',
      iconColor: 'bg-red-500'
    },
    {
      title: 'Out of Stock Items',
      description: 'Count of items currently out of stock',
      value: '15',
      icon: '❌',
      iconBg: 'bg-gray-100',
      iconColor: 'bg-gray-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className={`p-2 ${stat.iconBg} rounded-lg`}>
              <div className={`w-6 h-6 ${stat.iconColor} rounded flex items-center justify-center`}>
                <span className="text-white text-xs">{stat.icon}</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-900">{stat.title}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
