"use client";
import { useState, useEffect } from "react";
import {
  X,
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  Phone,
  Store,
  Mail,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  Copy,
  FileText,
  ShoppingBag,
  MessageCircle,
  ChevronDown,
  Undo2
} from "lucide-react";
import OrderStatusUpdateModal from "./OrderStatusUpdateModal";
import RefundModal from "./RefundModal";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import useOrderProcessingStore from "@/store/orderProcessingStore";

// The actual order-detail view -- header, products, payment breakdown,
// customer/shipping/contact panels, status-update wiring -- shared between
// OrderDetailsModal (the in-app popup opened from the Orders list) and
// apps/dashboard/src/app/dashboard/orders/[id]/page.js (a standalone route
// so a link to one specific order -- e.g. the "View order" button in the
// new-order-received email -- actually resolves to something). onClose is
// optional: the modal wrapper passes it (renders the X button), the page
// route doesn't (no X button; the page has its own back link instead).
export default function OrderDetailsContent({
  order: initialOrder,
  onStatusUpdate,
  updatingStatus = false,
  onClose
}) {
  const router = useRouter();
  const { secureApiCall } = useAuth();
  const { setProcessingOrder } = useOrderProcessingStore();
  const [copied, setCopied] = useState(false);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(true); // ✅ Open by default

  // Update local order when prop changes
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // Refresh order data from server
  const refreshOrderData = async () => {
    if (!order?.id) return;

    try {
      const response = await secureApiCall(`/api/orders/${order.id}`);
      if (response.success) {
        setOrder(response.data);
      }
    } catch (error) {
      console.error('Error refreshing order data:', error);
    }
  };

  // This component is fed two different item/order shapes depending on
  // which parent renders it: the standalone /dashboard/orders/[id] page
  // passes the single-order GET response directly (includes refundSplit),
  // while OrderDetailsModal (opened from the Orders list) passes the list
  // endpoint's own transformed shape, which never queried
  // order_payment_splits at all -- so refundSplit is simply absent there,
  // not null. A one-time refetch from the single-order endpoint once
  // converges both paths onto the same canonical data the Refund button's
  // gating depends on, without duplicating that query into the list route.
  useEffect(() => {
    if (initialOrder?.id && initialOrder.refundSplit === undefined) {
      refreshOrderData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder?.id]);

  if (!order) return null;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    const statusMap = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      processing: { color: 'bg-purple-100 text-purple-800', icon: Package },
      shipped: { color: 'bg-indigo-100 text-indigo-800', icon: Truck },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
      refunded: { color: 'bg-gray-100 text-gray-800', icon: DollarSign }
    };

    return statusMap[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  // Copy order number
  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Check if order can be processed (instead of just updated)
  const canProcessOrder = () => {
    // Only allow processing for confirmed orders that haven't been completed
    const processableStatuses = ['confirmed', 'processing'];
    return processableStatuses.includes(order.status);
  };

  // Handle processing order in POS
  const handleProcessOrder = () => {
    if (!order) return;

    // Create order object with complete variant information
    const orderWithVariants = {
      ...order,
      items: order.items.map(item => ({
        ...item,
        // Map product_id to inventoryId for POS compatibility
        inventoryId: item.product_id,
        // Explicitly map price fields for POS compatibility
        sellingPrice: item.sellingPrice || item.unitPrice || item.unit_price || 0,
        unitPrice: item.unitPrice || item.unit_price || item.sellingPrice || 0,
        // Ensure variant information is included
        variant: item.variant ? {
          size: item.variant.size,
          color: item.variant.color,
          variantSku: item.variant.variantSku,
          variantId: item.variant.variantId,
          images: item.variant.images || []
        } : null,
        productSnapshot: {
          ...item.productSnapshot,
          hasVariants: item.productSnapshot.hasVariants || false
        }
      }))
    };

    // Set the order in the processing store
    setProcessingOrder(orderWithVariants);

    onClose?.();

    // Navigate to POS page
    router.push('/dashboard/pos');
  };

  // Check if order can be confirmed and processed
  const canConfirmAndProcess = () => {
    // Only allow for pending orders
    return order.status === 'pending';
  };

  // Handle confirming order and starting processing
  const handleConfirmAndProcess = async () => {
    if (!order) return;

    setIsConfirmingOrder(true);

    try {
      // First, update the order status to confirmed
      const statusUpdateData = {
        status: 'confirmed',
        note: 'Order confirmed and ready for processing via POS system',
        updatedBy: 'admin'
      };

      await onStatusUpdate(order.id, statusUpdateData);

      // Create updated order object with variant information for processing store
      const confirmedOrder = {
        ...order,
        status: 'confirmed',
        // Ensure variant information is properly included in items
        items: order.items.map(item => ({
          ...item,
          // Map product_id to inventoryId for POS compatibility
          inventoryId: item.product_id,
          // Explicitly map price fields for POS compatibility
          sellingPrice: item.sellingPrice || item.unitPrice || item.unit_price || 0,
          unitPrice: item.unitPrice || item.unit_price || item.sellingPrice || 0,
          // Include variant details if they exist
          variant: item.variant ? {
            size: item.variant.size,
            color: item.variant.color,
            variantSku: item.variant.variantSku,
            variantId: item.variant.variantId,
            images: item.variant.images || []
          } : null,
          // Also include product snapshot
          productSnapshot: {
            ...item.productSnapshot,
            hasVariants: item.productSnapshot.hasVariants || false
          }
        }))
      };

      // Set the confirmed order in the processing store
      setProcessingOrder(confirmedOrder);

      onClose?.();

      // Navigate to POS page
      router.push('/dashboard/pos');

    } catch (error) {
      console.error('Error confirming order:', error);
      alert('Failed to confirm order: ' + error.message);
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  // Check if status can be updated
  const canUpdateStatus = () => {
    const finalStatuses = ['delivered', 'cancelled', 'refunded'];
    return !finalStatuses.includes(order.status);
  };

  // Handle opening status update modal
  const handleOpenStatusUpdate = () => {
    // Does NOT call onClose() -- see the identical comment on
    // handleOpenRefund below. When this component is rendered inside
    // OrderDetailsModal, calling onClose() here flips that popup's own
    // isOpen state to false in the same React batch as this function's own
    // setIsStatusUpdateModalOpen(true), which unmounts this whole component
    // (and the status-update modal within it) before the local update ever
    // gets a chance to render -- from the Orders-list popup, this button
    // used to just silently close everything instead of opening the modal.
    setIsStatusUpdateModalOpen(true);
  };

  // A refund is only meaningful once there's a real online payment to
  // refund from, and only once (a split already 'reversed' has nothing
  // left) -- mirrors the refund route's own guards exactly, so the button
  // never appears somewhere the API would just reject it.
  const canRefund = () => {
    return (
      order.paymentInfo?.provider === 'paystack' &&
      ['completed', 'partially_refunded'].includes(order.paymentInfo?.status) &&
      order.refundSplit &&
      order.refundSplit.status !== 'reversed'
    );
  };

  const handleOpenRefund = () => {
    // Deliberately does NOT call onClose() -- unlike handleOpenStatusUpdate,
    // which dismisses the parent OrderDetailsModal popup on the same click
    // that opens its own sub-modal. When this component is rendered inside
    // that popup, onClose() flips the popup's own isOpen state to false,
    // and since both state updates land in the same React batch, the
    // popup (and this whole component, and any modal state local to it)
    // unmounts before the sub-modal's open-state update ever gets a chance
    // to render -- the sub-modal would never actually appear, just a
    // silent close. RefundModal is its own full-screen overlay, so it
    // renders fine on top of the still-open popup without needing to
    // dismiss it first.
    setIsRefundModalOpen(true);
  };

  const handleRefundComplete = async () => {
    await refreshOrderData();
    setIsRefundModalOpen(false);
  };

  // Handle status update completion
  const handleStatusUpdateComplete = async (orderId, updateData) => {
    try {
      // Call the parent's status update function
      await onStatusUpdate(orderId, updateData);

      // Refresh the order data to get updated timeline
      await refreshOrderData();

      // Close the status update modal
      setIsStatusUpdateModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  // Handle contact via WhatsApp
  const handleWhatsAppContact = () => {
    const phone = order.customerSnapshot.phone || order.shippingAddress?.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hello ${order.customerSnapshot.firstName}, regarding your order #${order.orderNumber}`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    setShowContactDropdown(false);
  };

  // Handle contact via Email
  const handleEmailContact = () => {
    const email = order.customerSnapshot.email;
    const subject = encodeURIComponent(`Order #${order.orderNumber}`);
    const body = encodeURIComponent(`Hello ${order.customerSnapshot.firstName},\n\nRegarding your order #${order.orderNumber}...\n\nBest regards`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    setShowContactDropdown(false);
  };

  // ✅ Handle contact via Phone Call
  const handlePhoneCall = () => {
    const phone = order.customerSnapshot.phone || order.shippingAddress?.phone || '';
    window.location.href = `tel:${phone}`;
    setShowContactDropdown(false);
  };

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-100 rounded-xl">
            <ShoppingBag className="w-6 h-6 text-brand-800" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900">#{order.orderNumber}</h2>
              <button
                onClick={copyOrderNumber}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy order number"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="flex items-center space-x-3 mt-2">
              <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3 mr-1.5" />
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              <span className="text-sm text-gray-500">
                Order date {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-500">
                Order from <span className="font-medium text-gray-700">{order.orderSource || 'online store'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {canUpdateStatus() && (
            <button
              onClick={handleOpenStatusUpdate}
              className="flex items-center space-x-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              <Edit className="w-4 h-4" />
              <span>Update Status</span>
            </button>
          )}

          {canConfirmAndProcess() && (
            <button
              onClick={handleConfirmAndProcess}
              disabled={isConfirmingOrder}
              className="flex items-center space-x-2 px-5 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
            >
              {isConfirmingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Start Processing</span>
                </>
              )}
            </button>
          )}

          {canProcessOrder() && !canConfirmAndProcess() && (
            <button
              onClick={handleProcessOrder}
              className="flex items-center space-x-2 px-5 py-2.5 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors font-medium shadow-sm"
            >
              <Package className="w-4 h-4" />
              <span>Continue Processing</span>
            </button>
          )}

          {canRefund() && (
            <button
              onClick={handleOpenRefund}
              className="flex items-center space-x-2 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              <Undo2 className="w-4 h-4" />
              <span>Refund</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Products */}
            <div className="lg:col-span-2 space-y-6">
              {/* Products Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Products</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border ${
                    order.isMultiVendor ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {order.isMultiVendor ? (
                      <>
                        <Store className="w-3 h-3 mr-1" />
                        Multi-vendor
                      </>
                    ) : (
                      <><Package className="w-3 h-3 mr-1" />Unfulfilled</>
                    )}
                  </span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {order.items.map((item, index) => (
                      <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {item.productSnapshot?.image || item.variant?.image ? (
                              <img
                                src={item.variant?.image || item.productSnapshot?.image}
                                alt={item.productSnapshot?.productName || 'Product'}
                                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">
                              {item.productSnapshot?.productName || 'Unknown product'}
                            </h4>

                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>SKU: {item.productSnapshot?.sku || '—'}</span>
                              {item.variant && item.variant.size && item.variant.color && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-700 font-medium">
                                    {item.variant.color} • {item.variant.size}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span>Quantity {item.quantity}</span>
                            </div>

                            {/* Store Info */}
                            {item.storeSnapshot && (
                              <div className="mt-2 flex items-center space-x-2 text-xs">
                                <Store className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600">{item.storeSnapshot.storeName}</span>
                              </div>
                            )}

                            {/* Note the customer left when adding this item -- e.g. "no onions" */}
                            {item.notes && (
                              <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                                <p className="text-xs text-amber-800">
                                  <span className="font-semibold">Note:</span> {item.notes}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Price */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(item.subtotal)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatCurrency(item.unitPrice)} × {item.quantity}
                            </p>
                          </div>
                        </div>

                        {/* Reserved Item Badge */}
                        {item.itemStatus === 'reserved' && (
                          <div className="mt-3 inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md">
                            <Clock className="w-3 h-3 mr-1" />
                            Reserved Item
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Payment Method</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        {order.paymentInfo.method === 'card' && <CreditCard className="w-4 h-4 text-gray-600 mr-1.5" />}
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {order.paymentInfo.method.replace('_', ' ')}
                        </span>
                      </div>
                      {order.paymentInfo.transactionId && (
                        <span className="text-xs text-gray-500 font-mono">#{order.paymentInfo.transactionId.slice(-4)}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal ({order.itemCount} item{order.itemCount !== 1 ? 's' : ''})</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(order.subtotal)}</span>
                    </div>

                    {order.shippingFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Shipping ({order.shippingMethod || 'Standard'})</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(order.shippingFee)}</span>
                      </div>
                    )}

                    {order.payOnDeliveryFee > 0 && (
                      <div className="flex items-center justify-between text-sm rounded-lg border border-dashed border-gray-300 px-3 py-2 mt-1">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Truck className="w-3.5 h-3.5 flex-shrink-0" />
                          Customer owes you on delivery
                        </span>
                        <span className="text-gray-900 font-semibold">{formatCurrency(order.payOnDeliveryFee)}</span>
                      </div>
                    )}

                    {order.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount</span>
                        <span className="text-red-600 font-medium">-{formatCurrency(order.discount)}</span>
                      </div>
                    )}

                    {order.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900 font-medium">{formatCurrency(order.tax)}</span>
                      </div>
                    )}

                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-gray-900">Total</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">Paid ({order.paymentInfo.method})</span>
                        <span className={`text-sm font-semibold ${
                          order.paymentInfo.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Notes */}
              {order.customerNotes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Note</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-900 leading-relaxed">{order.customerNotes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Customer & Shipping */}
            <div className="space-y-6">
              {/* Customer */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-brand-800" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {order.customerSnapshot.firstName} {order.customerSnapshot.lastName}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${order.customerSnapshot.email}`} className="text-brand-800 hover:text-brand-900 hover:underline truncate">
                        {order.customerSnapshot.email}
                      </a>
                    </div>
                    {order.customerSnapshot.phone && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <a href={`tel:${order.customerSnapshot.phone}`} className="text-brand-800 hover:text-brand-900 hover:underline">
                          {order.customerSnapshot.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                      </p>
                      <button
                        onClick={() => {
                          const fullAddress = [
                            order.shippingAddress.street,
                            order.shippingAddress.landmark,
                            order.shippingAddress.city,
                            order.shippingAddress.state,
                            order.shippingAddress.postalCode,
                            order.shippingAddress.country
                          ].filter(Boolean).join(', ');

                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
                            '_blank',
                            'noopener,noreferrer'
                          );
                        }}
                        className="text-xs text-brand-800 hover:text-brand-900 mt-1 flex items-center space-x-1"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>View on Map</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    {order.shippingAddress.street && (
                      <p>{order.shippingAddress.street}</p>
                    )}
                    {order.shippingAddress.landmark && (
                      <p>{order.shippingAddress.landmark}</p>
                    )}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}</p>
                  </div>

                  {order.shippingAddress.phone && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${order.shippingAddress.phone}`} className="text-brand-800 hover:text-brand-900">
                          {order.shippingAddress.phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${order.customerSnapshot.email}`} className="text-brand-800 hover:text-brand-900 hover:underline">
                      {order.customerSnapshot.email}
                    </a>
                  </div>
                  {order.shippingAddress.phone && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${order.shippingAddress.phone}`} className="text-brand-800 hover:text-brand-900 hover:underline">
                        +{order.shippingAddress.phone.replace(/[^0-9]/g, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500 italic">No tags</p>
                </div>
              </div>
            </div>
            {/* Floating Contact Client Button - Bottom Right on Desktop.
                position: fixed (not absolute) so it anchors to the
                viewport regardless of context -- the modal wrapper used to
                supply a fixed inset-0 ancestor that made an absolute child
                behave this way by coincidence; the standalone page has no
                such ancestor. */}
            <div className="fixed bottom-8 right-8 z-10 hidden lg:block">
              <div className="relative">
                {/* Dropdown Menu */}
                {showContactDropdown && (
                  <div className="absolute bottom-16 right-0 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                    <div className="p-2">
                      <button
                        onClick={handleWhatsAppContact}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                          <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                          <p className="text-xs text-gray-500">Send message</p>
                        </div>
                      </button>

                      <button
                        onClick={handlePhoneCall}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                          <Phone className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Phone Call</p>
                          <p className="text-xs text-gray-500">Call directly</p>
                        </div>
                      </button>

                      <button
                        onClick={handleEmailContact}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email</p>
                          <p className="text-xs text-gray-500">Send email</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Button */}
                <button
                  onClick={() => setShowContactDropdown(!showContactDropdown)}
                  className="flex items-center space-x-2 px-6 py-4 bg-brand-800 text-white rounded-full hover:bg-brand-900 transition-all shadow-lg hover:shadow-xl group"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-medium">Contact Client</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Contact Button */}
      <div className="lg:hidden border-t border-gray-200 p-4 bg-white">
        <div className="relative">
          {/* Dropdown Menu for Mobile */}
          {showContactDropdown && (
            <div className="absolute bottom-16 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden mb-2">
              <div className="p-2">
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                    <p className="text-xs text-gray-500">Send message</p>
                  </div>
                </button>

                <button
                  onClick={handlePhoneCall}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Phone className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Phone Call</p>
                    <p className="text-xs text-gray-500">Call directly</p>
                  </div>
                </button>

                <button
                  onClick={handleEmailContact}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-xs text-gray-500">Send email</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowContactDropdown(!showContactDropdown)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors font-medium"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Contact Client</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Order Status Update Modal */}
      <OrderStatusUpdateModal
        isOpen={isStatusUpdateModalOpen}
        onClose={() => setIsStatusUpdateModalOpen(false)}
        order={order}
        onStatusUpdate={handleStatusUpdateComplete}
        isUpdating={updatingStatus}
      />

      {/* Refund Modal */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        order={order}
        onRefundComplete={handleRefundComplete}
      />
    </>
  );
}
