"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";

// Import modular components
import InventoryDetailsHeader from "@/components/dashboard/Inventory/InventoryDetailsHeader";
import InventoryProductOverview from "@/components/dashboard/Inventory/InventoryProductOverview";
import InventoryAdditionalInfo from "@/components/dashboard/Inventory/InventoryAdditionalInfo";
import InventoryQuickActions from "@/components/dashboard/Inventory/InventoryQuickActions";
import InventoryBatchStatus from "@/components/dashboard/Inventory/InventoryBatchStatus";
import InventoryStockAlert from "@/components/dashboard/Inventory/InventoryStockAlert";
import InventoryVariantsSection from "@/components/dashboard/Inventory/InventoryVariantsSection";

// Import existing modals
import EditInventoryModal from "@/components/dashboard/EditInventoryModal";
import StockUpdateModal from "@/components/dashboard/StockUpdateModal";
import InventoryActivityPanel from "@/components/dashboard/InventoryActivityPanel";
import AddBatchModal from "@/components/dashboard/AddBatchModal";
import DeleteConfirmationModal from "@/components/dashboard/DeleteConfirmationModal";

export default function InventoryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { secureApiCall } = useAuth();
  const [item, setItem] = useState(null);
  const [activeBatches, setActiveBatches] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Fetch inventory item details
  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      const response = await secureApiCall(`/api/inventory/${id}`);
      if (response.success) {
        setItem(response.data);
      } else {
        setError(response.message || 'Item not found');
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to load item details');
    } finally {
      setLoading(false); // Always set loading to false, even on error
    }
  };

  // Fetch batches for this item
  const fetchItemBatches = async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await secureApiCall(`/api/inventory/${id}/batches?_t=${timestamp}`);
      if (response.success) {
        console.log('Fetched batches:', response.data.batches);
        setAllBatches(response.data.batches);
        setActiveBatches(response.data.batches.filter(batch => batch.status === 'active'));
        console.log('Active batches set:', response.data.batches.filter(batch => batch.status === 'active'));
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        await Promise.all([
          fetchItemDetails(),
          fetchItemBatches()
        ]);
        setLoading(false);
      };
      loadData();
    }
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const calculateProfitMargin = (item) => {
    if (!item || item.costPrice === 0) return 0;
    return (((item.sellingPrice - item.costPrice) / item.costPrice) * 100).toFixed(1);
  };

  // Handle editing inventory item
  const handleEditItem = async (itemId, itemData) => {
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(itemData)
      });

      if (response.success) {
        console.log('Item updated successfully, updating local state...');
        
        // Immediately update the item state with new data for instant feedback
        setItem(prev => ({
          ...prev,
          ...itemData,
          updatedAt: new Date().toISOString()
        }));
        
        // If price, supplier, or location changed, update the active batch state too
        const priceChanged = itemData.costPrice !== item.costPrice || itemData.sellingPrice !== item.sellingPrice;
        const supplierChanged = itemData.supplier !== item.supplier;
        const locationChanged = itemData.location !== item.location;
        
        if (priceChanged || supplierChanged || locationChanged) {
          // Update active batches with new prices/info
          setAllBatches(prev => prev.map(batch => {
            // Only update the oldest active batch (FIFO)
            const isOldestActive = batch.status === 'active' && 
              batch.quantityRemaining > 0 && 
              batch._id === activeBatches.sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived))[0]?._id;
            
            if (isOldestActive) {
              return {
                ...batch,
                costPrice: itemData.costPrice !== undefined ? parseFloat(itemData.costPrice) : batch.costPrice,
                sellingPrice: itemData.sellingPrice !== undefined ? parseFloat(itemData.sellingPrice) : batch.sellingPrice,
                supplier: itemData.supplier || batch.supplier,
                batchLocation: itemData.location || batch.batchLocation
              };
            }
            return batch;
          }));
          
          setActiveBatches(prev => prev.map(batch => {
            const isOldestActive = batch.quantityRemaining > 0 && 
              batch._id === activeBatches.sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived))[0]?._id;
            
            if (isOldestActive) {
              return {
                ...batch,
                costPrice: itemData.costPrice !== undefined ? parseFloat(itemData.costPrice) : batch.costPrice,
                sellingPrice: itemData.sellingPrice !== undefined ? parseFloat(itemData.sellingPrice) : batch.sellingPrice,
                supplier: itemData.supplier || batch.supplier,
                batchLocation: itemData.location || batch.batchLocation
              };
            }
            return batch;
          }));
        }
        
        console.log('Local state updated with new data');
        setIsEditModalOpen(false);
        return response;
      } else {
        throw new Error(response.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  // Handle stock update
  const handleStockUpdate = async (itemId, updateData) => {
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}/stock`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response.success) {
        await fetchItemDetails();
        return response;
      } else {
        throw new Error(response.message || 'Failed to update stock');
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  // Handle adding new batch
  const handleAddBatch = async (itemId, batchData) => {
    try {
      const response = await secureApiCall(`/api/inventory/${itemId}/batches`, {
        method: 'POST',
        body: JSON.stringify(batchData)
      });

      if (response.success) {
        await fetchItemDetails();
        return response;
      } else {
        throw new Error(response.message || 'Failed to add batch');
      }
    } catch (error) {
      console.error('Error adding batch:', error);
      throw error;
    }
  };

  // Handle deleting this item
  const handleDeleteItem = async (reason) => {
    setIsDeletingItem(true);
    try {
      const response = await secureApiCall(`/api/inventory/${id}/delete?reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE'
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete item');
      }

      router.push('/dashboard/inventory');
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Get current active batch (FIFO: oldest active batch with stock remaining --
  // that's the batch the system actually sells from and prices against next,
  // matching /api/inventory's own "First In, First Out" methodology)
  const getCurrentBatch = () => {
    if (activeBatches.length > 0) {
      return activeBatches.sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived))[0];
    }
    if (allBatches.length > 0) {
      return allBatches.sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived))[0];
    }
    return null;
  };

  // Calculate batch-based pricing
  const getBatchBasedPricing = () => {
    const currentBatch = getCurrentBatch();
    
    if (!currentBatch) {
      return {
        currentCostPrice: item?.costPrice || 0,
        currentSellingPrice: item?.sellingPrice || 0,
        averageCostPrice: item?.costPrice || 0,
        averageSellingPrice: item?.sellingPrice || 0,
        profitMargin: item ? calculateProfitMargin(item) : 0
      };
    }

    // Calculate weighted averages across all batches
    const totalQuantityIn = allBatches.reduce((sum, batch) => sum + batch.quantityIn, 0);
    const weightedCostSum = allBatches.reduce((sum, batch) => sum + (batch.costPrice * batch.quantityIn), 0);
    const weightedSellingSum = allBatches.reduce((sum, batch) => sum + (batch.sellingPrice * batch.quantityIn), 0);

    const averageCostPrice = totalQuantityIn > 0 ? weightedCostSum / totalQuantityIn : currentBatch.costPrice;
    const averageSellingPrice = totalQuantityIn > 0 ? weightedSellingSum / totalQuantityIn : currentBatch.sellingPrice;

    return {
      currentCostPrice: currentBatch.costPrice,
      currentSellingPrice: currentBatch.sellingPrice,
      averageCostPrice: averageCostPrice,
      averageSellingPrice: averageSellingPrice,
      profitMargin: currentBatch.costPrice > 0 ? (((currentBatch.sellingPrice - currentBatch.costPrice) / currentBatch.costPrice) * 100).toFixed(1) : 0,
      batchInfo: currentBatch
    };
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading..." subtitle="Please wait">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading item details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !item) {
    return (
      <DashboardLayout title="Error" subtitle="Something went wrong">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Item Not Found</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard/inventory')}
              className="px-4 py-2 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-colors"
            >
              Back to Inventory
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const batchPricing = getBatchBasedPricing();
  const currentBatch = getCurrentBatch();

  return (
    <DashboardLayout title={item.productName} subtitle="Product Details">
      <InventoryDetailsHeader item={item} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <InventoryProductOverview
            item={item}
            currentBatch={currentBatch}
            activeBatches={activeBatches}
            allBatches={allBatches}
            batchPricing={batchPricing}
            onEdit={() => setIsEditModalOpen(true)}
            onDelete={() => setIsDeleteModalOpen(true)}
          />

          <InventoryAdditionalInfo item={item} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <InventoryQuickActions
            onEdit={() => setIsEditModalOpen(true)}
            onAddBatch={() => setIsAddBatchModalOpen(true)}
            onUpdateStock={() => setIsStockModalOpen(true)}
            onViewActivity={() => setIsActivityPanelOpen(true)}
            onViewAnalytics={() => router.push(`/dashboard/analytics?item=${item._id}`)}
          />

          <InventoryBatchStatus
            item={item}
            currentBatch={currentBatch}
            batchPricing={batchPricing}
            onAddBatch={() => setIsAddBatchModalOpen(true)}
            formatCurrency={formatCurrency}
          />

          <InventoryStockAlert item={item} />
        </div>
      </div>

{/* Variants Section - Show if item has variants */}
          {item.hasVariants && item.variants && item.variants.length > 0 && (
            <InventoryVariantsSection
              item={item}
              formatCurrency={formatCurrency}
            />
          )}
      {/* Modals */}
      <EditInventoryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditItem}
        item={item}
      />

      <StockUpdateModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onSubmit={handleStockUpdate}
        item={item}
      />

      <InventoryActivityPanel
        isOpen={isActivityPanelOpen}
        onClose={() => setIsActivityPanelOpen(false)}
        item={item}
      />

      <AddBatchModal
        isOpen={isAddBatchModalOpen}
        onClose={() => setIsAddBatchModalOpen(false)}
        onSubmit={handleAddBatch}
        item={item}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteItem}
        item={item}
        isDeleting={isDeletingItem}
      />
    </DashboardLayout>
  );
}
