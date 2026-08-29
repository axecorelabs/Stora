"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { customer, isAuthenticated, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Re-fetches and replaces local cart state without deleting anything
  // server-side -- unlike clearCart() below, which calls DELETE /api/cart
  // (a full reset). Needed after order creation: cart clearing now happens
  // server-side in orders/create (scoped to what's actually settled, with
  // payment-pending items deliberately left in the cart until payment
  // confirms), so the frontend just needs to pick up whatever changed
  // rather than force a clear of its own.
  const refreshCart = async () => {
    if (!isAuthenticated) {
      setCart(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/cart", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('[CartContext] Cart fetched:', {
            itemCount: data.cart?.item_count,
            itemsLength: data.cart?.items?.length,
            cart: data.cart
          });
          setCart(data.cart);
          setFetchError(null);
        } else {
          console.error("Cart fetch failed:", data.message);
          setFetchError(data.message);
        }
      } else if (response.status === 401) {
        console.log("User not authenticated, skipping cart fetch");
        setCart(null);
      } else {
        console.error("Cart fetch error:", response.status);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      setFetchError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch cart when user is authenticated
  useEffect(() => {
    if (authLoading) return;
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, customer]);

  const addToCart = async (productId, quantity = 1, metadata = {}) => {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          quantity,
          variantId: metadata?.variantId,
          color: metadata?.color,
          size: metadata?.size,
          notes: metadata?.notes,
          modifiers: metadata?.modifiers
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { 
          success: false, 
          error: data.message || 'Failed to add to cart' 
        };
      }

      // Update local cart state
      setCart(data.cart);
      
      return { 
        success: true, 
        cart: data.cart,
        message: data.message 
      };
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { 
        success: false, 
        error: 'Failed to add item to cart' 
      };
    }
  };

  const removeFromCart = async (productId) => {
    if (!isAuthenticated) {
      throw new Error('Authentication required');
    }

    try {
      console.log('Removing item from cart:', productId);
      
      const response = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('Item removed successfully');
        setCart(data.cart);
        return { success: true };
      } else {
        console.error('Failed to remove item:', data.message);
        throw new Error(data.message || 'Failed to remove item from cart');
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`/api/cart/items/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ quantity: newQuantity }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCart(data.cart);
        return { success: true };
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      return { success: false, error: "Failed to update quantity" };
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch("/api/cart", {
        method: "DELETE",
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCart(null);
        return { success: true };
      }
    } catch (error) {
      console.error("Error clearing cart:", error);
      return { success: false, error: "Failed to clear cart" };
    }
  };

  const getCartTotal = () => {
    if (!cart) return 0;
    return cart.total || 0;
  };

  const getCartCount = () => {
    if (!cart) return 0;
    // Support both camelCase and snake_case
    return cart.item_count || cart.itemCount || 0;
  };

  const validateCart = async () => {
    if (!isAuthenticated || !cart) return { isValid: true, unavailableItems: [] };

    try {
      const response = await fetch("/api/cart/validate", {
        method: "POST",
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        return {
          isValid: data.isValid,
          unavailableItems: data.unavailableItems || []
        };
      }
    } catch (error) {
      console.error("Error validating cart:", error);
    }

    return { isValid: true, unavailableItems: [] };
  };

  const value = {
    cart,
    isLoading,
    fetchError,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    refreshCart,
    getCartTotal,
    getCartCount,
    validateCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
