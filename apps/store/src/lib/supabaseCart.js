import { supabaseAdmin } from './supabase';
import { findInventoryById, findActiveBatchesByInventoryId, resolveBatchPricing } from './supabaseStore';

// ============ CART OPERATIONS ============

export async function findCartByCustomerId(customerId, includeItems = true) {
  let query = supabaseAdmin
    .from('carts')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  const { data: cart, error } = await query;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error finding cart:', error);
    throw new Error('Failed to find cart');
  }

  // Get cart items if requested
  if (includeItems && cart) {
    const items = await findCartItems(cart.id);
    cart.items = items;
  }

  return cart;
}

export async function createCart(customerId) {
  // Generate UUID and timestamps
  const cartId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('carts')
    .insert({
      id: cartId,
      customer_id: customerId,
      subtotal: 0,
      tax: 0,
      discount: 0,
      shipping: 0,
      total: 0,
      item_count: 0,
      status: 'active',
      last_updated: now,
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cart:', error);
    throw error;
  }

  return data;
}

export async function getOrCreateCart(customerId, includeItems = true) {
  let cart = await findCartByCustomerId(customerId, includeItems);
  
  if (!cart) {
    cart = await createCart(customerId);
    if (includeItems) {
      cart.items = [];
    }
  }
  
  return cart;
}

export async function updateCart(cartId, updates) {
  const { data, error } = await supabaseAdmin
    .from('carts')
    .update({
      ...updates,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', cartId)
    .select()
    .single();

  if (error) {
    console.error('Error updating cart:', error);
    throw new Error('Failed to update cart');
  }

  return data;
}

export async function recalculateCartTotals(cartId) {
  // Get all cart items
  const items = await findCartItems(cartId);
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
  const itemCount = items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
  
  // Get current cart for tax, shipping, discount
  const { data: cart } = await supabaseAdmin
    .from('carts')
    .select('tax, discount, shipping, coupon_discount')
    .eq('id', cartId)
    .single();
  
  const tax = parseFloat(cart?.tax || 0);
  const discount = parseFloat(cart?.discount || 0);
  const shipping = parseFloat(cart?.shipping || 0);
  const couponDiscount = parseFloat(cart?.coupon_discount || 0);
  
  const total = subtotal + tax + shipping - discount - couponDiscount;
  
  // Update cart
  return await updateCart(cartId, {
    subtotal,
    item_count: itemCount,
    total
  });
}

export async function deleteCart(cartId) {
  const { error } = await supabaseAdmin
    .from('carts')
    .delete()
    .eq('id', cartId);

  if (error) {
    console.error('Error deleting cart:', error);
    throw new Error('Failed to delete cart');
  }

  return true;
}

// ============ CART ITEM OPERATIONS ============

export async function findCartItems(cartId) {
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error finding cart items:', error);
    throw new Error('Failed to find cart items');
  }

  return data || [];
}

export async function findCartItem(cartId, productId, variantId = null) {
  let query = supabaseAdmin
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .eq('product_id', productId);

  // If variant specified, need to check the product_snapshot JSONB field
  const { data, error } = await query;

  if (error) {
    console.error('Error finding cart item:', error);
    throw new Error('Failed to find cart item');
  }

  if (!data || data.length === 0) return null;

  // Filter by variant if specified
  if (variantId) {
    const item = data.find(item => 
      item.product_snapshot?.variant?.variant_id === variantId
    );
    return item || null;
  }

  return data[0];
}

export async function createCartItem(itemData) {
  // Generate UUID and timestamps for cart item
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  // Remove batch field from root level (it's only for logging, not a DB column)
  const { batch, ...dbItemData } = itemData;
  
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .insert({
      id: itemId,
      ...dbItemData,
      added_at: now,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cart item:', error);
    throw error;
  }

  return data;
}

export async function updateCartItem(itemId, updates) {
  const { data, error } = await supabaseAdmin
    .from('cart_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating cart item:', error);
    throw new Error('Failed to update cart item');
  }

  return data;
}

export async function deleteCartItem(itemId) {
  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting cart item:', error);
    throw new Error('Failed to delete cart item');
  }

  return true;
}

export async function deleteAllCartItems(cartId) {
  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId);

  if (error) {
    console.error('Error deleting cart items:', error);
    throw new Error('Failed to delete cart items');
  }

  return true;
}

// ============ HIGHER-LEVEL CART OPERATIONS ============

export async function addItemToCart(cart, itemData) {
  // Check if item already exists (same product and variant if applicable)
  const existingItem = await findCartItem(
    cart.id, 
    itemData.product_id, 
    itemData.product_snapshot?.variant?.variant_id
  );

  if (existingItem) {
    // Update existing item quantity
    const newQuantity = existingItem.quantity + itemData.quantity;
    const newSubtotal = newQuantity * parseFloat(existingItem.price);
    
    await updateCartItem(existingItem.id, {
      quantity: newQuantity,
      subtotal: newSubtotal
    });
  } else {
    // Add new item
    await createCartItem({
      cart_id: cart.id,
      ...itemData
    });
  }

  // Recalculate cart totals
  await recalculateCartTotals(cart.id);

  // Return updated cart with items
  return await findCartByCustomerId(cart.customer_id, true);
}

export async function removeItemFromCart(cart, productId, variantId = null) {
  // Find the item to remove
  const item = await findCartItem(cart.id, productId, variantId);
  
  if (!item) {
    throw new Error('Item not found in cart');
  }

  // Delete the item
  await deleteCartItem(item.id);

  // Recalculate cart totals
  await recalculateCartTotals(cart.id);

  // Return updated cart
  return await findCartByCustomerId(cart.customer_id, true);
}

export async function updateItemQuantity(cart, productId, quantity, variantId = null) {
  if (quantity === 0) {
    // Remove item if quantity is 0
    return await removeItemFromCart(cart, productId, variantId);
  }

  // Find the item
  const item = await findCartItem(cart.id, productId, variantId);

  if (!item) {
    throw new Error('Item not found in cart');
  }

  // Update quantity and subtotal
  const newSubtotal = quantity * parseFloat(item.price);
  await updateCartItem(item.id, {
    quantity,
    subtotal: newSubtotal
  });

  // Recalculate cart totals
  await recalculateCartTotals(cart.id);

  // Return updated cart
  return await findCartByCustomerId(cart.customer_id, true);
}

// Removes just the given cart_items rows (e.g. one store's items after a
// scoped/per-store checkout), leaving the rest of the cart intact --
// unlike clearCart, which wipes everything and is only correct for a
// whole-cart checkout.
export async function removeItemsFromCart(cart, itemIds) {
  for (const itemId of itemIds) {
    await deleteCartItem(itemId);
  }
  return await recalculateCartTotals(cart.id);
}

export async function clearCart(cart) {
  // Delete all cart items
  await deleteAllCartItems(cart.id);

  // Reset cart totals
  return await updateCart(cart.id, {
    subtotal: 0,
    item_count: 0,
    total: 0,
    status: 'abandoned'
  });
}

// ============ CART HELPERS ============

export async function enrichCartWithProductData(cart) {
  if (!cart || !cart.items || cart.items.length === 0) {
    return cart;
  }

  const enrichedItems = await Promise.all(
    cart.items.map(async (item) => {
      try {
        // Get fresh product data (already transformed to camelCase by findInventoryById)
        const product = await findInventoryById(item.product_id);
        
        if (!product) {
          return {
            ...item,
            isAvailable: false,
            error: 'Product not found'
          };
        }

        // Get current batch pricing. resolveBatchPricing distinguishes "no
        // batches at all" (fall back to flat inventory) from "batches
        // exist but are fully depleted" (report the batches' real total:
        // 0) -- the naive `sum || product.quantityInStock` this replaced
        // couldn't tell those apart, since both produce a falsy 0 sum, and
        // would revive a possibly-stale flat stock number for an item
        // whose batches are genuinely sold out.
        const batches = await findActiveBatchesByInventoryId(item.product_id);
        const { sellingPrice: currentPrice, availableQuantity: availableStock } =
          await resolveBatchPricing(product, batches);

        return {
          ...item,
          product_data: {
            product_name: product.productName,
            sku: product.sku,
            category: product.category,
            primary_image: product.image || (product.images && product.images.length > 0 ? product.images[0] : null),
            is_active: product.isActive,
          },
          current_price: currentPrice,
          available_stock: availableStock,
          isAvailable: product.isActive && availableStock >= item.quantity,
          price_changed: parseFloat(currentPrice) !== parseFloat(item.price),
          stock_sufficient: availableStock >= item.quantity
        };
      } catch (error) {
        console.error(`Error enriching cart item ${item.product_id}:`, error);
        return {
          ...item,
          isAvailable: false,
          error: 'Failed to load product data'
        };
      }
    })
  );

  return {
    ...cart,
    items: enrichedItems,
    has_unavailable_items: enrichedItems.some(item => !item.isAvailable)
  };
}

export async function validateCartStock(cart) {
  if (!cart || !cart.items || cart.items.length === 0) {
    return {
      isValid: true,
      unavailableItems: []
    };
  }

  const unavailableItems = [];

  for (const item of cart.items) {
    try {
      const product = await findInventoryById(item.product_id);

      // findInventoryById returns the transformed (camelCase) product
      // shape -- product.is_active doesn't exist on it and was always
      // undefined, so this check unconditionally flagged every cart item
      // as unavailable regardless of real stock.
      if (!product || !product.isActive) {
        unavailableItems.push({
          product_id: item.product_id,
          product_name: item.product_snapshot?.product_name,
          reason: 'Product not available',
          requested_quantity: item.quantity,
          available_quantity: 0
        });
        continue;
      }

      // Check stock availability
      const batches = await findActiveBatchesByInventoryId(item.product_id);
      const { availableQuantity: availableStock } = await resolveBatchPricing(product, batches);

      if (availableStock < item.quantity) {
        unavailableItems.push({
          product_id: item.product_id,
          product_name: item.product_snapshot?.product_name,
          reason: 'Insufficient stock',
          requested_quantity: item.quantity,
          available_quantity: availableStock
        });
      }
    } catch (error) {
      console.error(`Error validating item ${item.product_id}:`, error);
      unavailableItems.push({
        product_id: item.product_id,
        product_name: item.product_snapshot?.product_name,
        reason: 'Validation error',
        requested_quantity: item.quantity,
        available_quantity: 0
      });
    }
  }

  return {
    isValid: unavailableItems.length === 0,
    unavailableItems
  };
}

export async function prepareCartItemData(productId, quantity, variantData = null, notes = '') {
  // Get product details (already transformed to camelCase by findInventoryById)
  const product = await findInventoryById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.isActive) {
    throw new Error('Product is not available');
  }

  // Get current batch pricing
  const batches = await findActiveBatchesByInventoryId(productId);
  const { sellingPrice: currentPrice, availableQuantity: availableStock, activeBatches, currentBatch } =
    await resolveBatchPricing(product, batches);

  // Check stock availability
  if (availableStock < quantity) {
    throw new Error(`Only ${availableStock} items available`);
  }

  // Get store details using store_id (which should be UUID)
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('id, store_name, store_slug, store_phone, store_email, branding')
    .eq('id', product.storeId)
    .single();

  if (!store) {
    throw new Error('Store not found');
  }

  // Build cart item data for cart_items table
  const itemData = {
    product_id: productId,
    quantity,
    price: currentPrice,
    subtotal: quantity * parseFloat(currentPrice),
    store_id: store.id,
    product_snapshot: {
      product_name: product.productName,
      sku: product.sku,
      category: product.category,
      primary_image: product.image || (product.images && product.images.length > 0 ? product.images[0] : null),
      unit_of_measure: product.unitOfMeasure,
      has_batches: activeBatches.length > 0,
      variant: variantData || null,
      batch: currentBatch ? {
        batch_id: currentBatch.id,
        batch_code: currentBatch.batch_code,
        selling_price: currentBatch.selling_price,
        date_received: currentBatch.date_received
      } : null,
    },
    store_snapshot: {
      store_name: store.store_name,
      store_slug: store.store_slug,
    },
    notes: notes || ''
  };

  // Add batch info for logging purposes (not saved to DB)
  itemData.batch = itemData.product_snapshot.batch;

  return itemData;
}

export function sanitizeCart(cart) {
  if (!cart) return null;

  return {
    id: cart.id,
    customer_id: cart.customer_id,
    items: cart.items || [],
    subtotal: cart.subtotal || 0,
    tax: cart.tax || 0,
    discount: cart.discount || 0,
    shipping: cart.shipping || 0,
    total: cart.total || 0,
    coupon_code: cart.coupon_code,
    coupon_discount: cart.coupon_discount || 0,
    item_count: cart.item_count || 0,
    status: cart.status,
    last_updated: cart.last_updated,
    expires_at: cart.expires_at,
    created_at: cart.created_at,
    updated_at: cart.updated_at
  };
}
