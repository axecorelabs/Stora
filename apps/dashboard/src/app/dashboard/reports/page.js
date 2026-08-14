"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ScheduleCard from "@/components/dashboard/ScheduleCard";
import RevenueTrendChart from "@/components/dashboard/charts/RevenueTrendChart";
import CategoryBreakdownChart from "@/components/dashboard/charts/CategoryBreakdownChart";
import OrderStatusBreakdown from "@/components/dashboard/charts/OrderStatusBreakdown";
import TopProductsCard from "@/components/dashboard/charts/TopProductsCard";
import { useReportsData } from "@/hooks/useReportsData";
import {
  DollarSign,
  Receipt,
  Package,
  AlertCircle,
  TrendingUp,
  Download
} from "lucide-react";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function toCsvValue(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export default function ReportsPage() {
  const router = useRouter();
  const {
    isLoading,
    inventoryStats,
    categoryStats,
    salesStats,
    ordersStats,
    salesTrend,
    topProducts,
    recentSales,
    upcomingDeliveries,
    trendDays,
  } = useReportsData();

  // Real week-vs-month average comparison, not a fabricated number
  const revenueGrowth = useMemo(() => {
    if (!salesStats?.weekRevenue || !salesStats?.monthRevenue) return 0;
    const weeklyAvg = salesStats.weekRevenue / 7;
    const monthlyAvg = salesStats.monthRevenue / 30;
    if (monthlyAvg === 0) return 0;
    return Math.round(((weeklyAvg - monthlyAvg) / monthlyAvg) * 100);
  }, [salesStats]);

  const handleExportCsv = () => {
    const rows = [
      ['Stora business report', new Date().toLocaleString('en-GB')],
      [],
      ['Summary', ''],
      ['Total revenue (all-time)', salesStats?.totalRevenue || 0],
      ['Total sales (all-time)', salesStats?.totalSales || 0],
      ['Average sale value', salesStats?.avgSaleAmount || 0],
      ['Inventory value', inventoryStats?.totalStockValue || 0],
      ['Items in stock', inventoryStats?.totalItems || 0],
      ['Low stock items', inventoryStats?.lowStockItems || 0],
      ['Out of stock items', inventoryStats?.outOfStockItems || 0],
      ['Total orders', ordersStats?.totalOrders || 0],
      [],
      [`Daily revenue - last ${trendDays} days`],
      ['Date', 'Revenue', 'Sales'],
      ...salesTrend.map((d) => [d.date, d.revenue, d.orders]),
      [],
      ['Top selling products'],
      ['Product', 'Quantity sold', 'Revenue'],
      ...topProducts.map((p) => [p.productName, p.quantitySold, p.revenue]),
      [],
      ['Category breakdown'],
      ['Category', 'Units in stock', 'Stock value'],
      ...categoryStats.map((c) => [c.category, c.totalStock, c.totalValue]),
    ];

    const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stora-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Reports & Analysis" subtitle="Comprehensive business insights">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reports data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statsCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(salesStats?.totalRevenue),
      icon: DollarSign,
      tone: 'brand',
      description: `${salesStats?.totalSales || 0} sales all-time`
    },
    {
      title: 'Avg Sale Value',
      value: formatCurrency(salesStats?.avgSaleAmount),
      icon: Receipt,
      tone: 'gold',
      description: revenueGrowth !== 0
        ? `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}% week vs month avg`
        : 'Per completed sale'
    },
    {
      title: 'Inventory Value',
      value: formatCurrency(inventoryStats?.totalStockValue),
      icon: Package,
      tone: 'brand',
      description: `${inventoryStats?.totalItems || 0} items in stock`
    },
    {
      title: 'Stock Alerts',
      value: (inventoryStats?.lowStockItems || 0).toString(),
      icon: AlertCircle,
      tone: 'danger',
      description: `${inventoryStats?.outOfStockItems || 0} out of stock`
    },
    {
      title: 'Total Orders',
      value: (ordersStats?.totalOrders || 0).toString(),
      icon: TrendingUp,
      tone: 'gold',
      description: `${ordersStats?.pendingOrders || 0} pending`
    },
  ];

  return (
    <DashboardLayout title="Reports & Analysis" subtitle="Comprehensive business insights">
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-brand-800 text-white rounded-lg text-sm font-medium hover:bg-brand-900 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-gray-100">
          {statsCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                    stat.tone === 'danger' ? 'bg-red-100 text-red-600' :
                    stat.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-gray-500">{stat.title}</span>
                </div>
                <p className={`text-2xl font-bold ${stat.tone === 'danger' ? 'text-red-600' : 'text-gray-900'}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue trend */}
        <div className="lg:col-span-8">
          <RevenueTrendChart
            data={salesTrend}
            growth={revenueGrowth}
            rangeLabel={`last ${trendDays} days`}
            onViewMore={() => router.push('/dashboard/sales')}
          />
        </div>

        {/* Delivery schedule (own lg:col-span-4 baked into the component) */}
        <ScheduleCard deliveries={upcomingDeliveries} />

        {/* Order status breakdown */}
        <div className="lg:col-span-4">
          <OrderStatusBreakdown stats={ordersStats} onViewMore={() => router.push('/dashboard/orders')} />
        </div>

        {/* Category breakdown */}
        <div className="lg:col-span-4">
          <CategoryBreakdownChart categories={categoryStats} onViewMore={() => router.push('/dashboard/inventory')} />
        </div>

        {/* Top selling products */}
        <div className="lg:col-span-4">
          <TopProductsCard products={topProducts} onViewMore={() => router.push('/dashboard/inventory')} />
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-12">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
              <button
                onClick={() => router.push('/dashboard/sales')}
                className="text-sm text-brand-800 hover:text-brand-900 font-medium"
              >
                View all
              </button>
            </div>

            {recentSales.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentSales.map((sale) => (
                  <div key={sale._id || sale.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-brand-800" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">#{sale.transactionId}</p>
                        <p className="text-xs text-gray-500">{formatDate(sale.saleDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-gray-500">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No sales yet</p>
                <p className="text-gray-400 text-xs">Sales will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
