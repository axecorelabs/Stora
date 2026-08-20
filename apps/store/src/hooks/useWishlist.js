import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const WISHLIST_QUERY_KEY = ['wishlist'];

export const useWishlist = () => {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
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
    // Optimistic: every liked-state consumer reads off this same cache
    // (useIsInWishlist), so writing the new item here flips the heart the
    // instant it's tapped instead of waiting on the round trip. onSuccess
    // then reconciles with the server's real (enriched) wishlist, and
    // onError rolls the placeholder back out if the request actually failed.
    onMutate: async ({ productId }) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const previous = queryClient.getQueryData(WISHLIST_QUERY_KEY);
      queryClient.setQueryData(WISHLIST_QUERY_KEY, (old) => ({
        ...(old || {}),
        items: [...(old?.items || []), { product_id: productId }]
      }));
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, data.wishlist);
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
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const previous = queryClient.getQueryData(WISHLIST_QUERY_KEY);
      queryClient.setQueryData(WISHLIST_QUERY_KEY, (old) => ({
        ...(old || {}),
        items: (old?.items || []).filter((item) => item.product_id !== productId)
      }));
      return { previous };
    },
    onError: (error, productId, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, data.wishlist);
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
