import { supabaseAdmin } from './supabase';
import { findInventoryById } from './supabaseStore';

// ============ WISHLIST OPERATIONS ============

// Find wishlist by customer ID
export async function findWishlistByCustomerId(customerId) {
  const { data, error } = await supabaseAdmin
    .from('wishlists')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding wishlist:', error);
    throw new Error('Failed to find wishlist');
  }

  return data;
}

// Find wishlist with items by customer ID
export async function findWishlistWithItems(customerId) {
  const wishlist = await findWishlistByCustomerId(customerId);
  
  if (!wishlist) {
    return null;
  }

  // Fetch wishlist items
  const { data: items, error } = await supabaseAdmin
    .from('wishlist_items')
    .select('*')
    .eq('wishlist_id', wishlist.id)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching wishlist items:', error);
    throw new Error('Failed to fetch wishlist items');
  }

  return {
    ...wishlist,
    items: items || []
  };
}

// Create wishlist for customer
export async function createWishlist(customerId) {
  // Generate UUID for the wishlist (Supabase doesn't auto-generate by default)
  const wishlistId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('wishlists')
    .insert({
      id: wishlistId,
      customer_id: customerId,
      name: 'My Wishlist',
      total_items: 0,
      total_value: 0,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating wishlist:', error);
    throw new Error('Failed to create wishlist');
  }

  return data;
}

// Get or create wishlist
export async function getOrCreateWishlist(customerId) {
  let wishlist = await findWishlistByCustomerId(customerId);
  
  if (!wishlist) {
    wishlist = await createWishlist(customerId);
  }
  
  return wishlist;
}

// Add item to wishlist
export async function addItemToWishlist(customerId, itemData) {
  try {
    const wishlist = await getOrCreateWishlist(customerId);

    // Check if item already exists
    const { data: existing } = await supabaseAdmin
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', itemData.product_id)
      .single();

    if (existing) {
      throw new Error('Product already in wishlist');
    }

    // Generate UUID and timestamps
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert new wishlist item
    const { data, error } = await supabaseAdmin
      .from('wishlist_items')
      .insert({
        id: itemId,
        wishlist_id: wishlist.id,
        product_id: itemData.product_id,
        product_snapshot: itemData.product_snapshot || {},
        store_id: itemData.store_id,
        store_snapshot: itemData.store_snapshot || {},
        priority: itemData.priority || 'medium',
        notes: itemData.notes || '',
        price_drop_alert: itemData.price_drop_alert ?? true,
        back_in_stock_alert: itemData.back_in_stock_alert ?? true,
        target_price: itemData.target_price || null,
        added_at: now,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding item to wishlist:', error);
      throw new Error('Failed to add item to wishlist');
    }

    // Update wishlist totals
    await updateWishlistTotals(wishlist.id);

    return data;
  } catch (error) {
    console.error('Error in addItemToWishlist:', error);
    throw error;
  }
}

// Remove item from wishlist
export async function removeItemFromWishlist(customerId, productId) {
  try {
    const wishlist = await findWishlistByCustomerId(customerId);

    if (!wishlist) {
      throw new Error('Wishlist not found');
    }

    // Delete the wishlist item
    const { error } = await supabaseAdmin
      .from('wishlist_items')
      .delete()
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId);

    if (error) {
      console.error('Error removing item from wishlist:', error);
      throw new Error('Failed to remove item from wishlist');
    }

    // Update wishlist totals
    await updateWishlistTotals(wishlist.id);

    return { success: true };
  } catch (error) {
    console.error('Error in removeItemFromWishlist:', error);
    throw error;
  }
}

// Update wishlist item
export async function updateWishlistItem(customerId, productId, updates) {
  try {
    const wishlist = await findWishlistByCustomerId(customerId);

    if (!wishlist) {
      throw new Error('Wishlist not found');
    }

    // Update the wishlist item
    const { data, error } = await supabaseAdmin
      .from('wishlist_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('wishlist_id', wishlist.id)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating wishlist item:', error);
      throw new Error('Failed to update wishlist item');
    }

    return data;
  } catch (error) {
    console.error('Error in updateWishlistItem:', error);
    throw error;
  }
}

// Update wishlist totals (total_items and total_value)
async function updateWishlistTotals(wishlistId) {
  try {
    // Get all items for this wishlist
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('wishlist_items')
      .select('product_snapshot')
      .eq('wishlist_id', wishlistId);

    if (itemsError) {
      console.error('Error fetching wishlist items for totals:', itemsError);
      return;
    }

    const totalItems = items?.length || 0;
    const totalValue = items?.reduce((sum, item) => {
      const price = parseFloat(item.product_snapshot?.base_price || 0);
      return sum + price;
    }, 0) || 0;

    // Update wishlist
    const { error: updateError } = await supabaseAdmin
      .from('wishlists')
      .update({
        total_items: totalItems,
        total_value: totalValue,
        last_updated: new Date().toISOString()
      })
      .eq('id', wishlistId);

    if (updateError) {
      console.error('Error updating wishlist totals:', updateError);
    }
  } catch (error) {
    console.error('Error in updateWishlistTotals:', error);
  }
}

// Prepare wishlist item data
export async function prepareWishlistItemData(productId, options = {}) {
  const { priority = 'medium', notes = '', priceDropAlert = true, backInStockAlert = true, targetPrice = null } = options;

  // Uses the transformed product shape (findInventoryById), not a raw
  // `inventory` row -- price/stock now live on inventory_variants, and
  // this used to read inventory.base_price directly, a column that's no
  // longer authoritative (or written to) at all.
  const product = await findInventoryById(productId);

  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.isActive) {
    throw new Error('Product is not available');
  }

  // Get store details
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, store_slug')
    .eq('id', product.storeId)
    .single();

  if (!store) {
    throw new Error('Store not found');
  }

  return {
    product_id: productId,
    store_id: store.id,
    priority,
    notes,
    price_drop_alert: priceDropAlert,
    back_in_stock_alert: backInStockAlert,
    target_price: targetPrice,
    product_snapshot: {
      name: product.productName,
      description: product.description,
      base_price: product.sellingPrice,
      primary_image: product.image,
      category: product.category,
      sku: product.sku
    },
    store_snapshot: {
      store_id: store.id,
      store_name: store.store_name,
      store_slug: store.store_slug
    }
  };
}

// Enrich wishlist with fresh product data
export async function enrichWishlistWithProductData(wishlist) {
  if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
    return wishlist;
  }

  // Batched, not per-item -- items only ever carry a bare store_id, no
  // name/slug snapshot (unlike cart_items/order_items, which do). The
  // vendor-scoped wishlist page never needed this (it already knows which
  // store it's on from the URL), but a cross-vendor view has to label and
  // link each item's own store.
  const storeIds = [...new Set(wishlist.items.map(item => item.store_id).filter(Boolean))];
  const { data: stores } = storeIds.length > 0
    ? await supabaseAdmin.from('stores').select('id, store_name, store_slug').in('id', storeIds)
    : { data: [] };
  const storeById = new Map((stores || []).map(s => [s.id, s]));

  const enrichedItems = await Promise.all(
    wishlist.items.map(async (item) => {
      const store = storeById.get(item.store_id);
      const store_data = store ? { store_name: store.store_name, store_slug: store.store_slug } : null;

      try {
        const product = await findInventoryById(item.product_id);

        if (!product) {
          return {
            ...item,
            store_data,
            is_available: false,
            error: 'Product not found'
          };
        }

        // product is the transformed shape (findInventoryById) -- reads
        // product.base_price/.stock_quantity here (fields that don't
        // exist on it, only on a raw DB row) always evaluated to
        // undefined, so price_changed/in_stock were silently wrong for
        // every wishlist item before this fix, independent of the
        // variant migration.
        const currentPrice = product.sellingPrice;
        const priceChanged = parseFloat(currentPrice) !== parseFloat(item.product_snapshot?.base_price || 0);

        return {
          ...item,
          store_data,
          product_data: {
            name: product.productName,
            base_price: currentPrice,
            primary_image: product.image,
            category: product.category,
            is_active: product.isActive,
            stock_quantity: product.availableQuantity
          },
          is_available: product.isActive,
          in_stock: (product.availableQuantity || 0) > 0,
          price_changed: priceChanged,
          current_price: currentPrice
        };
      } catch (error) {
        console.error(`Error enriching wishlist item ${item.product_id}:`, error);
        return {
          ...item,
          store_data,
          is_available: false,
          error: 'Failed to load product data'
        };
      }
    })
  );

  return {
    ...wishlist,
    items: enrichedItems
  };
}