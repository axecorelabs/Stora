#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function investigate() {
  // Check orders
  const { data: orders, error: ordersErr } = await client.from('orders').select('id, order_number, store_id, status');
  console.log('=== Orders in database ===');
  console.log('Error:', ordersErr?.message || 'none');
  console.log('Total orders:', orders?.length || 0);
  console.log('Orders with null store_id:', orders?.filter(o => !o.store_id).length || 0);
  
  // Check order_items - see if they have store_id
  const { data: orderItems } = await client.from('order_items').select('id, order_id, store_id, seller_id').limit(10);
  console.log('\n=== Order Items ===');
  console.log('Count:', orderItems?.length || 0);
  if (orderItems && orderItems.length > 0) {
    console.log('First item:', JSON.stringify(orderItems[0], null, 2));
    console.log('Items with store_id:', orderItems.filter(i => i.store_id).length);
    console.log('Items with seller_id:', orderItems.filter(i => i.seller_id).length);
  }
  
  // Check stores
  const { data: stores } = await client.from('stores').select('id, store_name, owner_id').limit(5);
  console.log('\n=== Stores ===');
  console.log('Count:', stores?.length || 0);
  
  // If order_items have store_id, we can update orders
  if (orderItems && orderItems.some(i => i.store_id)) {
    console.log('\n=== Can fix orders using order_items.store_id ===');
    
    // Group order items by order_id and get their store_ids
    const orderStoreMap = {};
    for (const item of orderItems) {
      if (item.store_id && item.order_id) {
        orderStoreMap[item.order_id] = item.store_id;
      }
    }
    console.log('Order -> Store mapping:', orderStoreMap);
  }
}

investigate().catch(console.error);
