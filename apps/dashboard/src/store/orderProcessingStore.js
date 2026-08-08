import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useOrderProcessingStore = create(
  persist(
    (set, get) => ({
      // Current order being processed
      processingOrder: null,
      
      // POS cart state from order
      orderCart: [],
      orderCustomer: null,
      
      // Processing state
      isProcessingOrder: false,
      
      // Set order for processing
      setProcessingOrder: (order) => {
        if (!order) {
          set({
            processingOrder: null,
            orderCart: [],
            orderCustomer: null,
            isProcessingOrder: false
          });
          return;
        }

        // Transform order items to cart format with variant information
        const cartItems = order.items.map(item => {
          // Get price from various possible fields
          const itemPrice = item.sellingPrice || item.unitPrice || item.unit_price || item.price || 0;
          
          // Get inventory ID - check all possible sources
          // OrderDetailsModal sets: inventoryId = product_id
          // Orders API sets: _id = product_id (and keeps product_id)
          const inventoryId = item._id || item.inventoryId || item.product_id;
          
          console.log('Order Processing Store - Mapping item:', {
            item_id: item._id,
            inventoryId: item.inventoryId,
            product_id: item.product_id,
            calculated_inventoryId: inventoryId,
            productName: item.productSnapshot?.productName
          });
          
          const baseItem = {
            _id: inventoryId,
            productName: item.productSnapshot.productName,
            sku: item.productSnapshot.sku,
            sellingPrice: itemPrice,
            costPrice: itemPrice * 0.7, // Estimate if not available
            quantityInStock: 9999, // Large number for order processing
            quantity: item.quantity,
            category: item.productSnapshot.category,
            unitOfMeasure: item.productSnapshot.unitOfMeasure || 'Piece',
            image: item.productSnapshot.image,
            hasVariants: item.productSnapshot.hasVariants || false
          };

          // Include variant information if it exists
          if (item.variant && item.variant.size && item.variant.color) {
            return {
              ...baseItem,
              variant: {
                size: item.variant.size,
                color: item.variant.color,
                variantSku: item.variant.variantSku,
                variantId: item.variant.variantId,
                images: item.variant.images || []
              },
              // Override display name to include variant
              displayName: `${item.productSnapshot.productName} (${item.variant.color} - ${item.variant.size})`,
              // Use variant SKU if available
              sku: item.variant.variantSku || item.productSnapshot.sku
            };
          }

          return baseItem;
        });

        // Extract customer information
        const customer = {
          name: `${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}`.trim(),
          phone: order.customerSnapshot.phone || '',
          email: order.customerSnapshot.email || '',
          address: order.shippingAddress ? {
            street: order.shippingAddress.street,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            country: order.shippingAddress.country,
            postalCode: order.shippingAddress.postalCode,
            landmark: order.shippingAddress.landmark
          } : null
        };

        set({
          processingOrder: order,
          orderCart: cartItems,
          orderCustomer: customer,
          isProcessingOrder: true
        });
      },
      
      // Clear processing state
      clearProcessingOrder: () => {
        set({
          processingOrder: null,
          orderCart: [],
          orderCustomer: null,
          isProcessingOrder: false
        });
      },
      
      // Update cart during processing
      updateOrderCart: (cart) => {
        set({ orderCart: cart });
      },
      
      // Update customer during processing
      updateOrderCustomer: (customer) => {
        set({ orderCustomer: customer });
      },
      
      // Complete order processing
      completeOrderProcessing: () => {
        const state = get();
        set({
          processingOrder: null,
          orderCart: [],
          orderCustomer: null,
          isProcessingOrder: false
        });
        return state.processingOrder;
      }
    }),
    {
      name: 'order-processing-storage',
      partialize: (state) => ({
        processingOrder: state.processingOrder,
        orderCart: state.orderCart,
        orderCustomer: state.orderCustomer,
        isProcessingOrder: state.isProcessingOrder
      })
    }
  )
);

export default useOrderProcessingStore;
