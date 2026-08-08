import { create } from 'zustand';

const useStoreStore = create((set, get) => ({
  currentStore: null,
  isLoading: false,
  error: null,

  setStore: (store) => set({ currentStore: store, error: null }),

  fetchStore: async (websitePath) => {
    if (!websitePath) return;

    const { currentStore } = get();
    
    // Don't fetch if we already have the correct store
    if (currentStore?.website?.websitePath === websitePath) {
      return currentStore;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('Fetching store for path:', websitePath);
      
      // Use the public endpoint
      const response = await fetch(`/api/stores/public/${websitePath}`);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log('Store fetched successfully:', data.store.storeName);
        set({ 
          currentStore: data.store, 
          isLoading: false, 
          error: null 
        });
        return data.store;
      } else {
        console.error('Failed to fetch store:', data.message);
        set({ 
          currentStore: null, 
          isLoading: false, 
          error: data.message || 'Store not found' 
        });
        return null;
      }
    } catch (error) {
      console.error('Error fetching store:', error);
      set({ 
        currentStore: null, 
        isLoading: false, 
        error: 'Failed to load store' 
      });
      return null;
    }
  },

  clearStore: () => set({ currentStore: null, error: null }),

  updateStoreMetrics: async (views = 1, isOrder = false) => {
    const { currentStore } = get();
    if (!currentStore) return;

    try {
      // This could be a separate endpoint for analytics
      await fetch(`/api/stores/public/${currentStore.website.websitePath}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ views, isOrder }),
      });
    } catch (error) {
      console.log('Failed to update store metrics:', error);
      // Don't throw error, just log it
    }
  }
}));

export default useStoreStore;
