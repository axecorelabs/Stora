"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ReceiptModal from "@/components/dashboard/ReceiptModal";
import CreateStoreModal from "@/components/dashboard/CreateStoreModal";
import DeliveryScheduleModal from "@/components/dashboard/DeliveryScheduleModal";
import VariantSelectionModal from "@/components/dashboard/VariantSelectionModal";
import SectionHeader from "@/components/ui/SectionHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import useOrderProcessingStore from "@/store/orderProcessingStore";
import { usePOSData } from "@/hooks/usePOSData";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Calculator,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  Receipt,
  ShoppingCart,
  Package,
  Scan,
  Store,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  FileText
} from "lucide-react";

// Suggests round-number cash amounts a cashier can tap instead of typing,
// covering common Naira notes plus a couple of round-ups above the total
function getQuickCashAmounts(total) {
  if (!total || total <= 0) return [];
  const amounts = new Set();
  [500, 1000, 2000, 5000, 10000].forEach(note => {
    if (note >= total) amounts.add(note);
  });
  amounts.add(Math.ceil(total / 1000) * 1000);
  amounts.add(Math.ceil(total / 500) * 500);
  return Array.from(amounts).sort((a, b) => a - b).slice(0, 4);
}

export default function POSPage() {
  const { secureApiCall } = useAuth();
  const router = useRouter();
  
  // Order processing store
  const {
    processingOrder,
    orderCart,
    orderCustomer,
    isProcessingOrder,
    clearProcessingOrder,
    updateOrderCart,
    updateOrderCustomer,
    completeOrderProcessing
  } = useOrderProcessingStore();

  // Use TanStack Query for data fetching
  const {
    hasStore,
    store,
    inventoryItems,
    isLoading,
    processSale: processSaleMutation,
    scheduleDelivery: scheduleDeliveryMutation,
    updateOrderStatus: updateOrderStatusMutation,
    isProcessingSale: isSaleProcessing,
    refetchInventory,
    refetchStore,
  } = usePOSData();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [completedSale, setCompletedSale] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState(false);
  const [isDeliveryPromptOpen, setIsDeliveryPromptOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [pendingSaleForDelivery, setPendingSaleForDelivery] = useState(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedItemForVariant, setSelectedItemForVariant] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [addedToCartMessage, setAddedToCartMessage] = useState(null);

  const searchInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Brief "added to cart" confirmation -- resets its own timer on each
  // call rather than queuing, since a cashier scanning several items in
  // quick succession should just see the message update, not a stack of
  // toasts piling up.
  const showAddedToCartToast = (message) => {
    clearTimeout(toastTimeoutRef.current);
    setAddedToCartMessage(message);
    toastTimeoutRef.current = setTimeout(() => setAddedToCartMessage(null), 1800);
  };

  useEffect(() => {
    return () => clearTimeout(toastTimeoutRef.current);
  }, []);

  // Keep the search/scan field focused and ready -- a barcode scanner just
  // types into whatever has focus, so the cashier shouldn't need to click first
  useEffect(() => {
    if (!isLoading) {
      searchInputRef.current?.focus();
    }
  }, [isLoading]);

  // Show create store modal if no store
  useEffect(() => {
    if (hasStore === false) {
      setIsCreateStoreModalOpen(true);
    }
  }, [hasStore]);

  // Handle store creation
  const handleStoreCreated = (newStore) => {
    setIsCreateStoreModalOpen(false);
    refetchStore();
    refetchInventory();
  };

  // Filter items using useMemo instead of useEffect to prevent infinite loop
  const filteredItems = useMemo(() => {
    let filtered = inventoryItems;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.barcode?.toLowerCase().includes(term) ||
        item.brand?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    return filtered;
  }, [searchTerm, selectedCategory, inventoryItems]);

  // Get unique categories using useMemo
  const categories = useMemo(() => {
    return [...new Set(inventoryItems.map(item => item.category))];
  }, [inventoryItems]);

  // Handle Enter from the search box like a barcode scan: an exact barcode/SKU
  // match adds straight to cart, otherwise a single narrowed-down result does too
  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const term = searchTerm.trim().toLowerCase();
    if (!term) return;

    const exactMatch = inventoryItems.find(item =>
      item.barcode?.toLowerCase() === term || item.sku.toLowerCase() === term
    );
    const matchToAdd = exactMatch || (filteredItems.length === 1 ? filteredItems[0] : null);

    if (matchToAdd) {
      addToCart(matchToAdd);
      setSearchTerm('');
    }
  };

  // Add item to cart
  const addToCart = (item) => {
    // Check if item has variants
    if (item.hasVariants && item.variants && item.variants.length > 0) {
      // Open variant selection modal
      setSelectedItemForVariant(item);
      setIsVariantModalOpen(true);
      return;
    }

    // Regular non-variant item
    const existingItem = cart.find(cartItem =>
      cartItem._id === item._id && !cartItem.variant
    );

    if (existingItem) {
      if (existingItem.quantity < item.quantityInStock) {
        setCart(cart.map(cartItem =>
          cartItem._id === item._id && !cartItem.variant
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
        showAddedToCartToast(`${item.productName} added to cart`);
      } else {
        alert(`Only ${item.quantityInStock} units available`);
      }
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
      showAddedToCartToast(`${item.productName} added to cart`);
    }
  };

  // Handle adding variant item to cart
  const handleAddVariantToCart = (variantCartItem) => {
    // Check if this exact variant is already in cart
    const existingItem = cart.find(cartItem => 
      cartItem._id === variantCartItem._id && 
      cartItem.variant?.variantId === variantCartItem.variant.variantId
    );
    
    if (existingItem) {
      // Update quantity if variant already in cart
      const newQuantity = existingItem.quantity + variantCartItem.quantity;
      if (newQuantity <= variantCartItem.availableStock) {
        setCart(cart.map(cartItem =>
          cartItem._id === variantCartItem._id &&
          cartItem.variant?.variantId === variantCartItem.variant.variantId
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        ));
        showAddedToCartToast(`${variantCartItem.productName} added to cart`);
      } else {
        alert(`Only ${variantCartItem.availableStock} units available for this variant`);
      }
    } else {
      // Add new variant to cart
      setCart([...cart, variantCartItem]);
      showAddedToCartToast(`${variantCartItem.productName} added to cart`);
    }
  };

  // Update cart item quantity - modified to handle variants
  const updateCartQuantity = (itemId, newQuantity, variantId = null) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, variantId);
      return;
    }

    setCart(cart.map(cartItem => {
      // Match by itemId and variantId (if applicable)
      const isMatch = variantId 
        ? (cartItem._id === itemId && cartItem.variant?.variantId === variantId)
        : (cartItem._id === itemId && !cartItem.variant);
      
      if (isMatch) {
        const maxStock = cartItem.variant ? cartItem.availableStock : cartItem.quantityInStock;
        if (newQuantity > maxStock) {
          alert(`Only ${maxStock} units available`);
          return cartItem;
        }
        return { ...cartItem, quantity: newQuantity };
      }
      return cartItem;
    }));
  };

  // Remove item from cart - modified to handle variants
  const removeFromCart = (itemId, variantId = null) => {
    setCart(cart.filter(item => {
      if (variantId) {
        return !(item._id === itemId && item.variant?.variantId === variantId);
      }
      return !(item._id === itemId && !item.variant);
    }));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setCustomer({ name: '', phone: '' });
    setDiscount(0);
    setTax(0);
    setAmountReceived('');
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxAmount = ((subtotal - discountAmount) * tax) / 100;
  const total = subtotal - discountAmount + taxAmount;
  const balance = parseFloat(amountReceived || 0) - total;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Handle delivery scheduling
  const handleScheduleDelivery = async (deliveryData) => {
    try {
      await scheduleDeliveryMutation({
        saleId: pendingSaleForDelivery._id,
        transactionId: pendingSaleForDelivery.transactionId,
        orderId: pendingSaleForDelivery.linkedOrderId || null,
        deliveryType: pendingSaleForDelivery.isFromOrder ? 'order' : 'pos_sale',
        ...deliveryData
      });

      alert('Delivery scheduled successfully!');
      setIsDeliveryModalOpen(false);
      setPendingSaleForDelivery(null);
      setIsReceiptModalOpen(true);
    } catch (error) {
      console.error('Error scheduling delivery:', error);
      alert('Error scheduling delivery: ' + error.message);
    }
  };

  // Skip delivery scheduling
  const handleSkipDelivery = () => {
    setIsDeliveryPromptOpen(false);
    setPendingSaleForDelivery(null);
    setIsReceiptModalOpen(true);
  };

  // Process sale - modified to handle order processing with variants
  const processSale = async () => {
    // If processing an order, use the dedicated order completion function
    if (isProcessingOrder) {
      return await completeOrderSale();
    }

    // Regular POS sale flow
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    const saleTotal = total;
    const amountPaid = parseFloat(amountReceived || 0);

    // Only validate amount for cash payments in regular POS sales
    if (paymentMethod === 'cash' && amountPaid < saleTotal) {
      alert(`Insufficient payment. Total is ${formatCurrency(saleTotal)}`);
      return;
    }

    try {
      // Prepare sale items with variant information
      const saleItems = cart.map(item => {
        console.log('Processing cart item for sale:', {
          _id: item._id,
          inventoryId: item.inventoryId,
          product_id: item.product_id,
          productName: item.productName
        });
        
        const saleItem = {
          inventoryId: item._id,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          total: item.sellingPrice * item.quantity
        };

        // Include variant information if present
        if (item.variant && item.variant.size && item.variant.color) {
          saleItem.variant = {
            hasVariant: true,
            size: item.variant.size,
            color: item.variant.color,
            variantSku: item.variant.variantSku || item.variant.sku,
            variantId: item.variant.variantId
          };
        }

        return saleItem;
      });

      console.log('=== SENDING TO SALES API ===');
      console.log('Sale items:', JSON.stringify(saleItems, null, 2));
      console.log('First item inventoryId:', saleItems[0]?.inventoryId);

      // For transfer and POS payments, amount received equals total
      // For cash, use the entered amount
      const finalAmountReceived = paymentMethod === 'cash' ? amountPaid : saleTotal;
      const finalBalance = paymentMethod === 'cash' ? balance : 0;

      const saleData = {
        items: saleItems,
        customer: {
          name: customer.name || 'Walk-in Customer',
          phone: customer.phone || '',
          email: customer.email || ''
        },
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total: saleTotal,
        paymentMethod: paymentMethod,
        amountReceived: finalAmountReceived,
        balance: finalBalance,
        isOrderProcessing: false,
        isFromOrder: false
      };

      console.log('Processing sale with data:', saleData);

      // Call the function directly
      const result = await processSaleMutation(saleData);

      if (result.success) {
        // Ensure the completed sale has all the data including items with variants
        const completedSaleData = {
          ...saleData,
          _id: result.data._id,
          transactionId: result.data.transactionId,
          saleDate: result.data.saleDate || new Date().toISOString(),
          status: result.data.status || 'completed',
          items: saleItems // Ensure items with variant info are included
        };
        
        setCompletedSale(completedSaleData);
        
        // Clear cart and reset form
        clearCart();
        setCustomer({ name: '', phone: '' });
        setPaymentMethod('cash');
        setAmountReceived('');
        setDiscount(0);
        setTax(0);

        // Show receipt modal
        setIsReceiptModalOpen(true);

        // Refetch inventory to update stock
        refetchInventory();

        // Ready for the next customer
        searchInputRef.current?.focus();
      } else {
        throw new Error(result.message || 'Failed to process sale');
      }
    } catch (error) {
      console.error('Sale processing error:', error);
      alert(error.message || 'Failed to process sale');
    }
  };

  // Handle order processing completion - Updated to support variants
  const completeOrderSale = async () => {
    // Processing an order
    if (cart.length === 0) {
      alert('Please add items to cart before completing order');
      return;
    }
    
    // NO payment validation needed for order processing - payment already handled in order!

    try {
      // Ensure all values are properly calculated and formatted
      const calculatedSubtotal = cart.reduce((sum, item) => sum + (Number(item.sellingPrice) * Number(item.quantity)), 0);
      const calculatedDiscountAmount = (calculatedSubtotal * Number(discount)) / 100;
      const calculatedTaxAmount = ((calculatedSubtotal - calculatedDiscountAmount) * Number(tax)) / 100;
      const calculatedTotal = calculatedSubtotal - calculatedDiscountAmount + calculatedTaxAmount;
      const calculatedBalance = 0; // Always 0 for order processing

      // Prepare sale items with variant information
      const saleItems = cart.map(item => {
        const saleItem = {
          inventoryId: item._id,
          productName: item.productName,
          sku: item.sku,
          quantity: Number(item.quantity),
          unitPrice: Number(item.sellingPrice),
          total: Number(item.sellingPrice) * Number(item.quantity)
        };

        // Include variant information if present
        if (item.variant && item.variant.size && item.variant.color) {
          saleItem.variant = {
            size: item.variant.size,
            color: item.variant.color,
            variantSku: item.variant.variantSku,
            variantId: item.variant.variantId
          };
        }

        return saleItem;
      });

      // Create the sale with all required fields including variants
      const saleData = {
        items: saleItems,
        customer: customer || { name: '', phone: '', email: '' },
        subtotal: calculatedSubtotal,
        discount: calculatedDiscountAmount,
        tax: calculatedTaxAmount,
        total: calculatedTotal,
        paymentMethod: paymentMethod,
        amountReceived: calculatedTotal, // Set to total for order processing
        balance: calculatedBalance,
        saleDate: new Date().toISOString(),
        soldBy: null,
        linkedOrderId: processingOrder.id,
        isOrderProcessing: true,
        isFromOrder: true,
        orderNumber: processingOrder.orderNumber
      };

      console.log('Processing order sale with variants:', saleData);

      const saleResponse = await processSaleMutation(saleData);

      if (saleResponse.success) {
        console.log('Sale created successfully, now updating order status...');
        
        // Update order status to processed
        const statusUpdateData = {
          status: 'processed',
          note: `Order processed through POS. Sale transaction: ${saleResponse.data.transactionId}`,
          updatedBy: 'admin'
        };

        console.log('Updating order with ID:', processingOrder.id, 'to status:', statusUpdateData);

        try {
          await updateOrderStatusMutation({
            orderId: processingOrder.id,
            statusData: statusUpdateData
          });
          
          console.log('Order status updated successfully to processed');
        } catch (statusError) {
          console.error('Error updating order status:', statusError);
          alert('Sale completed but failed to update order status. Please update manually.');
        }

        const completedOrder = completeOrderProcessing();
        
        const completedSaleData = {
          ...saleData,
          _id: saleResponse.data._id,
          transactionId: saleResponse.data.transactionId,
          saleDate: saleResponse.data.saleDate || new Date().toISOString(),
          status: saleResponse.data.status || 'completed',
          processedOrder: completedOrder
        };
        
        setCompletedSale(completedSaleData);
        setPendingSaleForDelivery(completedSaleData);
        clearCart();
        setIsDeliveryPromptOpen(true);
      } else {
        throw new Error(saleResponse.message || 'Failed to create sale');
      }
    } catch (error) {
      console.error('Error processing order:', error);
      alert('Error processing order: ' + error.message);
    }
  };

  // Handle canceling order processing
  const cancelOrderProcessing = async () => {
    setIsCancelling(true);
    
    // If there's an order being processed, revert its status to pending
    if (processingOrder && processingOrder.id) {
      try {
        const response = await secureApiCall(`/api/orders/${processingOrder.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'pending',
            note: 'Order processing cancelled, reverted to pending status',
            updatedBy: 'admin'
          })
        });

        if (!response.success) {
          console.error('Failed to revert order status:', response.error);
          // Still clear processing state even if API call fails
        }
      } catch (error) {
        console.error('Error reverting order status:', error);
        // Still clear processing state even if error occurs
      }
    }

    clearProcessingOrder();
    clearCart();
    setIsCancelling(false);
    router.push('/dashboard/orders');
  };

  // Initialize POS with order data if processing an order
  useEffect(() => {
    if (isProcessingOrder && orderCart && orderCart.length > 0) {
      console.log('=== INITIALIZING POS WITH ORDER ===');
      console.log('Raw orderCart from store:', JSON.stringify(orderCart, null, 2));

      // Set cart with variant information preserved
      const cartWithVariants = orderCart.map(item => {
        console.log('Mapping order cart item:', {
          original_id: item._id,
          product_id: item.product_id,
          inventoryId: item.inventoryId,
          productName: item.productName
        });
        
        const cartItem = {
          ...item,
          // Ensure _id is set for inventory lookup (map from product_id or inventoryId)
          _id: item._id || item.product_id || item.inventoryId,
          // Map unit_price to sellingPrice for consistency
          sellingPrice: item.sellingPrice || item.unit_price || item.unitPrice || item.price,
          quantity: item.quantity || 1
        };
        
        console.log('Mapped cart item _id:', cartItem._id);

        // If item has variant information, preserve it
        if (item.variant && item.variant.size && item.variant.color) {
          cartItem.variant = {
            size: item.variant.size,
            color: item.variant.color,
            variantSku: item.variant.variantSku,
            variantId: item.variant.variantId,
            images: item.variant.images || []
          };
          
          // Ensure display name includes variant info
          cartItem.displayName = item.displayName || 
            `${item.productName} (${item.variant.color} - ${item.variant.size})`;
        }

        return cartItem;
      });

      setCart(cartWithVariants);

      // Set customer info
      if (orderCustomer) {
        setCustomer({
          name: orderCustomer.name || '',
          phone: orderCustomer.phone || ''
        });
      }

      console.log('Cart initialized with variants:', cartWithVariants);
    }
  }, [isProcessingOrder, orderCart, orderCustomer]);

  if (isLoading || hasStore === null) {
    return (
      <DashboardLayout title="Store Mode (POS)" subtitle="Point of Sale System">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Product Selection Skeleton - Left Side */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Search and Filters Skeleton */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>

              {/* Category Filter Skeleton */}
              <div className="flex items-center space-x-2 overflow-x-auto">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>

            {/* Product Grid Skeleton */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart and Checkout Skeleton - Right Side */}
          <div className="space-y-4 lg:space-y-6">
            {/* Cart Skeleton */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>

              <div className="space-y-3 max-h-64">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="w-8 h-4 bg-gray-200 rounded"></div>
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center py-8 hidden">
                <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
              </div>
            </div>

            {/* Customer Info Skeleton */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
              <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse"></div>
              <div className="space-y-3">
                <div className="h-11 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-11 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Payment and Totals Skeleton */}
            <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
              <div className="h-6 w-44 bg-gray-200 rounded mb-4 animate-pulse"></div>

              {/* Discount and Tax Skeleton */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="flex-1 h-11 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="flex-1 h-11 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                </div>
              </div>

              {/* Payment Method Skeleton */}
              <div className="mb-4">
                <div className="h-4 w-32 bg-gray-200 rounded mb-2 animate-pulse"></div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              </div>

              {/* Totals Skeleton */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-6 w-28 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Process Sale Button Skeleton */}
              <div className="w-full mt-4 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Store Mode (POS)" subtitle={store ? `${store.storeName} - Point of Sale` : "Point of Sale System"}>
      {/* Order Processing Header */}
      {isProcessingOrder && processingOrder && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Processing Order #{processingOrder.orderNumber}</h2>
                <p className="text-sm text-blue-700">
                  Customer: {orderCustomer?.name} • Items: {orderCart.length} • 
                  Total: {formatCurrency(processingOrder.totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard/orders')}
                className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Orders</span>
              </button>
              <button
                onClick={cancelOrderProcessing}
                disabled={isCancelling}
                className="flex items-center space-x-2 px-4 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isCancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Cancel Processing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Info Header */}
      {store && (
        <div className="mb-6 bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-brand-100 rounded-xl">
              <Store className="w-6 h-6 text-brand-800" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{store.storeName}</h2>
              <p className="text-sm text-gray-500">
                {store.fullAddress || 'No address set'} 
                {store.storePhone && ` • ${store.storePhone}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Existing POS content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Product Selection - Left Side */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products by name, SKU, or scan barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black"
                />
              </div>
              <button
                onClick={() => searchInputRef.current?.focus()}
                title="Scan a barcode or type a SKU, then press Enter to add it straight to the cart"
                className="p-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
              >
                <Scan className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === ''
                    ? 'bg-brand-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'bg-brand-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid - Modified to show variant badge */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader icon={Package} title="Products" tone="gold" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map(item => {
                const isLowStock = item.quantityInStock <= (item.reorderLevel || 0);
                const hasVariants = item.hasVariants && item.variants && item.variants.length > 0;
                // One badge at a time -- variant count takes priority over batch info
                // so cards never have to juggle two competing corner labels
                const cornerBadge = hasVariants
                  ? { label: `${item.variants.length} variant${item.variants.length === 1 ? '' : 's'}`, className: 'bg-purple-100 text-purple-700' }
                  : item.hasBatchPricing
                    ? { label: item.batchPricing?.activeBatchCode || 'Batch', className: 'bg-green-100 text-green-700' }
                    : null;

                return (
                <div
                  key={item._id}
                  className="flex flex-col border border-gray-200 rounded-xl p-3 hover:border-brand-800 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => addToCart(item)}
                >
                  <div className="relative aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}

                    {cornerBadge && (
                      <div className={`absolute top-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate text-[11px] px-2 py-0.5 rounded-full font-medium ${cornerBadge.className}`}>
                        {cornerBadge.label}
                      </div>
                    )}

                    {isLowStock && (
                      <div className="absolute bottom-1.5 left-1.5 bg-gold-500 text-brand-900 text-[11px] px-2 py-0.5 rounded-full font-semibold">
                        Low stock
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col">
                    <h4 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {item.productName}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 mb-2 truncate">{item.sku}</p>

                    <div className="mt-auto flex items-end justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-brand-800">
                          {formatCurrency(item.sellingPrice)}
                        </span>
                        {item.hasBatchPricing && item.sellingPrice !== item.originalSellingPrice && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatCurrency(item.originalSellingPrice)}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500">
                          {item.quantityInStock} in stock
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item);
                        }}
                        title="Add to cart"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-brand-800 text-white hover:bg-brand-900 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No products found</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart and Checkout - Right Side */}
        <div className="space-y-4 lg:space-y-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          {/* Cart - Modified to show variant info */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-800 mr-2">
                  <ShoppingCart className="w-4 h-4" />
                </span>
                {isProcessingOrder ? 'Order Items' : 'Cart'} ({cart.length})
              </h3>
              {cart.length > 0 && !isProcessingOrder && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.map((item, index) => {
                // Create unique key for variant items
                const itemKey = item.variant 
                  ? `${item._id || index}-${item.variant.variantId || index}` 
                  : (item._id || `item-${index}`);
                
                return (
                  <div key={itemKey} className={`flex items-center justify-between p-3 rounded-lg ${
                    item.isOrderItem ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {item.displayName || item.productName}
                        </h4>
                        {item.isOrderItem && (
                          <CheckCircle className="w-4 h-4 text-blue-600" title="From order" />
                        )}
                        {item.variant && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            Variant
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.sellingPrice)} each
                        {item.variant && ` • ${item.variant.color} - ${item.variant.size}`}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartQuantity(item._id, item.quantity - 1, item.variant?.variantId)}
                        className="p-1 text-gray-500 hover:text-red-600"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-gray-900 font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item._id, item.quantity + 1, item.variant?.variantId)}
                        className="p-1 text-gray-500 hover:text-brand-800"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item._id, item.variant?.variantId)}
                        className="p-1 text-gray-500 hover:text-red-600 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {cart.length === 0 && (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">
                  {isProcessingOrder ? 'No order items' : 'Cart is empty'}
                </p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader icon={User} title={`Customer Info ${isProcessingOrder ? '(From Order)' : ''}`} />
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Customer name"
                value={customer.name}
                onChange={(e) => {
                  const newCustomer = { ...customer, name: e.target.value };
                  setCustomer(newCustomer);
                  if (isProcessingOrder) {
                    updateOrderCustomer(newCustomer);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                  isProcessingOrder ? 'bg-blue-50 border-blue-200' : 'border-gray-300'
                }`}
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={customer.phone}
                onChange={(e) => {
                  const newCustomer = { ...customer, phone: e.target.value };
                  setCustomer(newCustomer);
                  if (isProcessingOrder) {
                    updateOrderCustomer(newCustomer);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-800 focus:border-transparent text-black ${
                  isProcessingOrder ? 'bg-blue-50 border-blue-200' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Payment and Totals */}
          <div className="bg-white rounded-2xl p-4 lg:p-6 border border-gray-100">
            <SectionHeader icon={Calculator} title="Payment & Totals" tone="gold" />

            {/* Discount and Tax */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 w-20">Discount:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 text-black"
                  placeholder="0"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 w-20">Tax:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 text-black"
                  placeholder="0"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-lg border text-sm font-medium ${
                    paymentMethod === 'cash'
                      ? 'border-brand-800 bg-brand-50 text-brand-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="w-4 h-4 mx-auto mb-1" />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-3 rounded-lg border text-sm font-medium ${
                    paymentMethod === 'transfer'
                      ? 'border-brand-800 bg-brand-50 text-brand-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1" />
                  Transfer
                </button>
                <button
                  onClick={() => setPaymentMethod('pos')}
                  className={`p-3 rounded-lg border text-sm font-medium ${
                    paymentMethod === 'pos'
                      ? 'border-brand-800 bg-brand-50 text-brand-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1" />
                  POS
                </button>
              </div>
            </div>

            {/* Amount Received - Only show for cash */}
            {paymentMethod === 'cash' && !isProcessingOrder && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Received</label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && cart.length > 0 && parseFloat(amountReceived || 0) >= total && !isSaleProcessing) {
                      e.preventDefault();
                      processSale();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-800 text-black"
                  placeholder="0.00"
                />
                {total > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setAmountReceived(String(total))}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors"
                    >
                      Exact ({formatCurrency(total)})
                    </button>
                    {getQuickCashAmounts(total).map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setAmountReceived(String(amount))}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount ({discount}%):</span>
                  <span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({tax}%):</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg text-gray-900 font-bold border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {paymentMethod === 'cash' && amountReceived && !isProcessingOrder && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Change:</span>
                  <span className={`font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              )}
            </div>

            {/* Process Sale Button */}
            <button
              onClick={processSale}
              disabled={
                cart.length === 0 || 
                isSaleProcessing || 
                (!isProcessingOrder && paymentMethod === 'cash' && parseFloat(amountReceived || 0) < total)
              }
              className="w-full mt-4 bg-brand-800 text-white py-3 rounded-xl font-medium hover:bg-brand-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isSaleProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isProcessingOrder ? 'Processing Order...' : 'Processing Sale...'}
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5 mr-2" />
                  {isProcessingOrder ? 'Complete Order' : 'Complete Sale'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Create Store Modal */}
      <CreateStoreModal
        isOpen={isCreateStoreModalOpen}
        onStoreCreated={handleStoreCreated}
      />

      {/* Delivery Prompt Modal */}
      {isDeliveryPromptOpen && pendingSaleForDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {pendingSaleForDelivery.isFromOrder ? 'Order Processed!' : 'Sale Completed!'}
              </h3>
              
              <p className="text-gray-600 mb-2">
                Transaction: {pendingSaleForDelivery.transactionId}
              </p>
              
              {pendingSaleForDelivery.processedOrder && (
                <p className="text-blue-600 text-sm mb-4">
                  Order #{pendingSaleForDelivery.processedOrder.orderNumber} processed successfully
                </p>
              )}
              
              <p className="text-gray-700 mb-6">
                Would you like to schedule a delivery for this {pendingSaleForDelivery.isFromOrder ? 'order' : 'sale'}?
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSkipDelivery}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  No, Skip
                </button>
                <button
                  onClick={() => {
                    setIsDeliveryPromptOpen(false);
                    setIsDeliveryModalOpen(true);
                  }}
                  className="flex-1 px-4 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
                >
                  Yes, Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Schedule Modal */}
      <DeliveryScheduleModal
        isOpen={isDeliveryModalOpen}
        onClose={() => {
          setIsDeliveryModalOpen(false);
          setPendingSaleForDelivery(null);
          setIsReceiptModalOpen(true);
        }}
        onSubmit={handleScheduleDelivery}
        sale={pendingSaleForDelivery}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
      />

      {/* Variant Selection Modal */}
      <VariantSelectionModal
        isOpen={isVariantModalOpen}
        onClose={() => {
          setIsVariantModalOpen(false);
          setSelectedItemForVariant(null);
        }}
        item={selectedItemForVariant}
        onAddToCart={handleAddVariantToCart}
      />

      {/* "Added to cart" toast -- the tap-to-add grid gave no feedback at
          all before this; a cashier scanning/tapping quickly needs to
          see something confirm each add without it blocking input the
          way an alert() would. */}
      {addedToCartMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-rise-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-xl">
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            {addedToCartMessage}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
