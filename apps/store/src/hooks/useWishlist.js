import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export const useWishlist = () => {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const response = await fetch('/api/wishlist', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch wishlist');
      }
      
      return data.wishlist;
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useWishlistMutations = () => {
  const queryClient = useQueryClient();

  const addToWishlist = useMutation({
    mutationFn: async ({ productId, priority = 'medium', notes = '' }) => {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          priority,
          notes,
          notifications: {
            priceDropAlert: true,
            backInStockAlert: true
          }
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    }
  });

  const removeFromWishlist = useMutation({
    mutationFn: async (productId) => {
      const response = await fetch(`/api/wishlist/${productId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    }
  });

  return { addToWishlist, removeFromWishlist };
};

// Hook to check if a product is in wishlist
export const useIsInWishlist = (productId) => {
  const { data: wishlist } = useWishlist();
  
  if (!wishlist?.items) return false;
  
  // Wishlist items are raw wishlist_items rows -- product_id, not a
  // nested product object (see supabaseWishlist.js).
  return wishlist.items.some(item => item.product_id === productId);
};
