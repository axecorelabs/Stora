#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function fixOrderStoreIds() {
  console.log('=== Fixing order store_ids ===\n');
  
  // Step 1: Get all stores and create owner_id -> store_id map
  const { data: stores, error: storesErr } = await client.from('stores').select('id, owner_id, store_name');
  if (storesErr) {
    console.error('Error fetching stores:', storesErr);
    return;
  }
  
  const ownerToStoreMap = {};
  stores.forEach(store => {
    ownerToStoreMap[store.owner_id] = store.id;
  });
  console.log('Owner to Store mapping:', Object.keys(ownerToStoreMap).length, 'entries');
  
  // Step 2: Get all order_items with seller_id
  const { data: orderItems, error: itemsErr } = await client.from('order_items').select('order_id, seller_id');
  if (itemsErr) {
    console.error('Error fetching order items:', itemsErr);
    return;
  }
  
  // Step 3: Create order_id -> store_id map via seller_id -> owner_id -> store_id
  const orderToStoreMap = {};
  for (const item of orderItems) {
    if (item.seller_id && item.order_id) {
      const storeId = ownerToStoreMap[item.seller_id];
      if (storeId) {
        orderToStoreMap[item.order_id] = storeId;
      }
    }
  }
  
  console.log('Order to Store mapping:', Object.keys(orderToStoreMap).length, 'entries');
  
  // Step 4: Update orders with their store_ids
  let updated = 0;
  let failed = 0;
  
  for (const [orderId, storeId] of Object.entries(orderToStoreMap)) {
    const { error } = await client
      .from('orders')
      .update({ store_id: storeId })
      .eq('id', orderId);
    
    if (error) {
      console.error(`Failed to update order ${orderId}:`, error.message);
      failed++;
    } else {
      updated++;
    }
  }
  
  console.log(`\n=== Results ===`);
  console.log(`Updated: ${updated} orders`);
  console.log(`Failed: ${failed} orders`);
  
  // Step 5: Also update order_items store_id
  console.log(`\n=== Updating order_items store_id ===`);
  
  let itemsUpdated = 0;
  for (const item of orderItems) {
    if (item.seller_id) {
      const storeId = ownerToStoreMap[item.seller_id];
      if (storeId) {
        const { error } = await client
          .from('order_items')
          .update({ store_id: storeId })
          .eq('order_id', item.order_id)
          .eq('seller_id', item.seller_id);
        
        if (!error) {
          itemsUpdated++;
        }
      }
    }
  }
  console.log(`Updated: ${itemsUpdated} order items`);
  
  // Verify
  const { data: ordersAfter } = await client.from('orders').select('id, store_id');
  const withStoreId = ordersAfter?.filter(o => o.store_id).length || 0;
  console.log(`\n=== Verification ===`);
  console.log(`Orders with store_id: ${withStoreId} / ${ordersAfter?.length || 0}`);
}

fixOrderStoreIds().catch(console.error);
