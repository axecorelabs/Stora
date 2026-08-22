"use client";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CustomDropdown from "@/components/ui/CustomDropdown";
import PayoutSettingsModal from "@/components/dashboard/PayoutSettingsModal";
import { usePayments } from "@/hooks/usePayments";
import {
  Wallet,
  Landmark,
  Search,
  TrendingUp,
  Receipt,
  Banknote,
  Undo2,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Percent,
  Loader2
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: '', label: 'All Transactions' },
  { value: 'paid', label: 'Paid out' },
  { value: 'processing', label: 'Processing' },
  { value: 'refunded', label: 'Refunded' }
];

// Nigerian date, no year for the "next payout" banner -- always near-term
// (the pipeline behind it is a rolling T+1 estimate), so a bare year adds
// noise without adding information.
function formatShortDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function PaymentsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  const {
    transactions,
    stats,
    payoutAccount,
    commissionBearer,
    commissionRate,
    minimumCommission,
    nextPayout,
    pagination,
    isLoading,
    isFetching,
    isError,
    refetch,
    prefetchNextPage,
    updateCommissionBearer,
    isUpdatingCommissionBearer
  } = usePayments({ page: currentPage, status: statusFilter, search: searchTerm });

  const handleCommissionBearerChange = async (value) => {
    if (value === commissionBearer || isUpdatingCommissionBearer) return;
    try {
      await updateCommissionBearer(value);
    } catch (error) {
      console.error('Failed to update commission preference:', error);
    }
  };

  useEffect(() => {
    if (pagination.hasMore) prefetchNextPage();
  }, [currentPage, pagination.hasMore, prefetchNextPage]);

  useEffect(() => {
    const handler = setTimeout(() => refetch(), 500);
    return () => clearTimeout(handler);
  }, [searchTerm, statusFilter, refetch]);

  // Page reset lives in the filter setters themselves (below), not a
  // separate effect watching statusFilter/searchTerm -- setting state
  // synchronously inside an effect just to mirror other state changes
  // triggers an extra cascading render for no benefit here.
  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const toggleExpanded = (id) => setExpandedId(prev => (prev === id ? null : id));

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setSearchTerm('');
  };

  // Deliberately no cumulative "platform commission paid" card -- the
  // commission on each transaction is already visible per-row in the
  // table (which is what accountability actually needs), and a running
  // total of fees taken reads as adversarial for no informational gain a
  // vendor couldn't already get by summing the rows themselves.
  const statsCards = stats ? [
    { title: 'Total Collected', value: formatCurrency(stats.totalGross), icon: TrendingUp, tone: 'brand', description: 'Gross sales through Stora' },
    { title: 'Net Earnings', value: formatCurrency(stats.totalNet), icon: Banknote, tone: 'brand', description: 'Your take-home, paid out or pending' },
    { title: 'Refunded', value: formatCurrency(stats.totalRefunded), icon: Undo2, tone: 'gold', description: 'Recorded refunds/disputes' },
    { title: 'Transactions', value: stats.transactionCount.toString(), icon: Receipt, tone: 'gold', description: 'All-time paid orders' }
  ] : [];

  if (isLoading) {
    return (
      <DashboardLayout title="Payments" subtitle="Track what Stora has collected and paid out on your behalf">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payments...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Payments" subtitle="Track what Stora has collected and paid out on your behalf">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load payments</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-brand-800 text-white rounded-lg hover:bg-brand-900">
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Payments" subtitle="Track what Stora has collected and paid out on your behalf">
      {isFetching && !isLoading && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-brand-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span className="text-sm font-medium">Checking for updates...</span>
          </div>
        </div>
      )}

      {/* Payout account status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-5 mb-4 lg:mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
            payoutAccount?.ready ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-700'
          }`}>
            {payoutAccount?.ready ? <Landmark className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </span>
          <div>
            {payoutAccount?.ready ? (
              <>
                <p className="text-sm font-semibold text-gray-900">
                  {payoutAccount.bankName} •••• {payoutAccount.accountNumberLast4}
                </p>
                <p className="text-xs text-gray-500">{payoutAccount.accountName} -- payouts settle automatically the next business day</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900">No payout account connected</p>
                <p className="text-xs text-gray-500">Add your bank details to start receiving online payments</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsPayoutModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-800 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"
        >
          {payoutAccount?.ready ? 'Manage payout account' : 'Set up payouts'}
        </button>
      </div>

      {/* Next payout forecast -- only shown once there's actually something
          pending; a store with nothing unsettled has nothing to forecast. */}
      {nextPayout && (
        <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4 lg:p-5 mb-4 lg:mb-6 flex items-center gap-3 flex-wrap">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-brand-100 text-brand-800">
            <Calendar className="w-5 h-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Next payout: {new Date(nextPayout.date).getTime() <= Date.now() ? 'any day now' : formatShortDate(nextPayout.date)}
              <span className="font-normal text-gray-600"> — ~{formatCurrency(nextPayout.amount)} across {nextPayout.count} transaction{nextPayout.count === 1 ? '' : 's'}</span>
            </p>
            <p className="text-xs text-gray-500">
              Estimated from Paystack's usual next-business-day payout -- confirmed automatically once it lands
            </p>
          </div>
        </div>
      )}

      {/* Commission bearer */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-5 mb-4 lg:mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-brand-100 text-brand-800">
            <Percent className="w-5 h-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Platform commission -- {Math.round(commissionRate * 100)}% per order, minimum {formatCurrency(minimumCommission)}
            </p>
            <p className="text-xs text-gray-500">
              Who pays it -- only applies to orders placed after you change this
            </p>
          </div>
          {isUpdatingCommissionBearer && <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-auto" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleCommissionBearerChange('vendor')}
            disabled={isUpdatingCommissionBearer}
            className={`text-left p-3 lg:p-4 rounded-xl border-2 transition-colors disabled:opacity-60 ${
              commissionBearer === 'vendor' ? 'border-brand-800 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">You absorb it</p>
            <p className="text-xs text-gray-500 mt-1">Deducted from your payout. Customers see just your listed price. (Default)</p>
          </button>
          <button
            onClick={() => handleCommissionBearerChange('customer')}
            disabled={isUpdatingCommissionBearer}
            className={`text-left p-3 lg:p-4 rounded-xl border-2 transition-colors disabled:opacity-60 ${
              commissionBearer === 'customer' ? 'border-brand-800 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">Pass it to the customer</p>
            <p className="text-xs text-gray-500 mt-1">Added on top at checkout. You keep the full listed price.</p>
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 lg:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-gray-100">
            {statsCards.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                      stat.tone === 'gold' ? 'bg-gold-500/15 text-gold-600' : 'bg-brand-100 text-brand-800'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-gray-500">{stat.title}</span>
                  </div>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-xl shrink-0 bg-brand-100 text-brand-800">
                <Wallet className="w-4.5 h-4.5" />
              </span>
              Transactions
            </h2>
            <div className="flex items-center flex-wrap gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by order number..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full sm:w-48 md:w-64 lg:w-72 bg-gray-50 border-0 rounded-xl focus:outline-none text-gray-900 focus:ring-2 focus:ring-brand-800 focus:bg-white text-sm transition-all duration-200"
                />
              </div>

              <CustomDropdown
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={handleStatusFilterChange}
                placeholder="Filter by status"
                className="w-48"
              />

              {(statusFilter || searchTerm) && (
                <button onClick={clearFilters} className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          {isFetching && !isLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-100 z-10">
              <div className="h-full bg-brand-800 animate-pulse transition-all" style={{ width: '60%' }}></div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 lg:px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Wallet className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg font-medium mb-2">No transactions found</p>
                      <p className="text-gray-400 text-sm">
                        {statusFilter || searchTerm ? 'Try adjusting your search or filter' : 'Paid orders will show up here'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isRefunded = tx.splitStatus === 'reversed';
                  const isSettled = tx.splitStatus === 'settled';
                  const isExpanded = expandedId === tx.id;

                  return (
                    <Fragment key={tx.id}>
                      <tr
                        onClick={() => toggleExpanded(tx.id)}
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/80' : ''}`}
                      >
                        <td className="px-4 lg:px-6 py-3">
                          <div className="text-sm font-medium text-gray-900">#{tx.orderNumber}</div>
                          <div className="text-xs text-gray-500 capitalize">{tx.orderStatus}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-right">
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{formatCurrency(tx.grossAmount)}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-right">
                          <div className="text-sm text-gray-600 whitespace-nowrap">
                            {formatCurrency(tx.commissionAmount)}
                            <span className="text-gray-400"> ({Math.round(tx.commissionRate * 100)}%)</span>
                          </div>
                          {/* Only flag the exception (customer paid it) --
                              vendor-absorbed is the default, no need to
                              label every single row with it. */}
                          {tx.commissionBearer === 'customer' && (
                            <div className="text-[10px] font-medium text-brand-800 whitespace-nowrap">customer paid</div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(tx.netAmount)}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            isRefunded ? 'bg-gray-100 text-gray-700' : isSettled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isRefunded ? <Undo2 className="w-3 h-3 mr-1" /> : isSettled ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {isRefunded ? 'Refunded' : isSettled ? 'Paid out' : 'Processing'}
                          </span>
                          {!isRefunded && !isSettled && tx.estimatedPayoutDate && (
                            <div className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                              Est. {formatShortDate(tx.estimatedPayoutDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          <div className="text-sm text-gray-600 whitespace-nowrap">{formatDate(tx.createdAt)}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-3">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan="7" className="px-4 md:px-8 py-4 md:py-6 bg-gray-50/60 border-b border-gray-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Payment method</p>
                                <p className="text-sm font-medium text-gray-900 capitalize">{tx.paymentMethod || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Reference</p>
                                <p className="text-sm font-medium text-gray-900 truncate">{tx.reference || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Paid at</p>
                                <p className="text-sm font-medium text-gray-900">{tx.paidAt ? formatDate(tx.paidAt) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Commission</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {tx.commissionBearer === 'customer'
                                    ? `Customer paid it (₦${tx.commissionAmount.toLocaleString('en-NG')} added)`
                                    : 'You absorbed it'}
                                </p>
                              </div>
                              {isRefunded && (
                                <div>
                                  <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">Refunded at</p>
                                  <p className="text-sm font-medium text-gray-900">{tx.refundedAt ? formatDate(tx.refundedAt) : '—'}</p>
                                </div>
                              )}
                              {!isRefunded && (
                                <div>
                                  <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                                    {isSettled ? 'Paid out' : 'Est. payout'}
                                  </p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {isSettled
                                      ? (tx.settledAt ? formatDate(tx.settledAt) : '—')
                                      : (tx.estimatedPayoutDate ? formatShortDate(tx.estimatedPayoutDate) : '—')}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="pt-4 mt-4 border-t border-gray-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/orders?search=${encodeURIComponent(tx.orderNumber)}`);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View order
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {transactions.length > 0 && pagination.pages > 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>
                  Showing {((pagination.current - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.current * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} transactions
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current === 1}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pagination.current === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-1">
                  {[...Array(pagination.pages)].map((_, index) => {
                    const pageNumber = index + 1;
                    if (
                      pageNumber === 1 ||
                      pageNumber === pagination.pages ||
                      (pageNumber >= pagination.current - 1 && pageNumber <= pagination.current + 1)
                    ) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            pagination.current === pageNumber ? 'bg-brand-800 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (pageNumber === pagination.current - 2 || pageNumber === pagination.current + 2) {
                      return <span key={pageNumber} className="px-2 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current === pagination.pages}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pagination.current === pagination.pages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {transactions.length > 0 && pagination.pages <= 1 && (
          <div className="px-4 lg:px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {transactions.length} of {pagination.total} transactions
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
        )}
      </div>

      {/* PayoutSettingsModal expects the same store.bankDetails shape
          stores/payouts's transformStore() produces -- payoutAccount.bankDetails
          from /api/payments is that same raw object, so no separate store
          fetch is needed just to open this modal from here. */}
      <PayoutSettingsModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        onPayoutUpdated={() => {
          setIsPayoutModalOpen(false);
          refetch();
        }}
        store={{ bankDetails: payoutAccount?.bankDetails || {} }}
      />
    </DashboardLayout>
  );
}
