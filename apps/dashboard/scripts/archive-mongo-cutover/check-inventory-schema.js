#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkInventorySchema() {
  try {
    console.log('🔍 Checking inventory-related tables in Supabase...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('❌ Missing Supabase credentials');
      console.log('URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey);
      return;
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check inventory table
    console.log('📦 INVENTORY TABLE:');
    const { data: inventory, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .limit(1);
    
    if (!invError) {
      console.log('✅ Inventory table exists');
      if (inventory && inventory.length > 0) {
        console.log('Columns:', Object.keys(inventory[0]).join(', '));
        console.log('Sample data:', JSON.stringify(inventory[0], null, 2));
      } else {
        console.log('No data in table');
      }
    } else {
      console.log('❌ Inventory table error:', invError.message);
    }
    
    // Check inventory_batches table
    console.log('\n📦 INVENTORY_BATCHES TABLE:');
    const { data: batches, error: batchError } = await supabaseAdmin
      .from('inventory_batches')
      .select('*')
      .limit(1);
    
    if (!batchError) {
      console.log('✅ Inventory batches table exists');
      if (batches && batches.length > 0) {
        console.log('Columns:', Object.keys(batches[0]).join(', '));
      } else {
        console.log('No data in table');
      }
    } else {
      console.log('❌ Inventory batches table error:', batchError.message);
    }
    
    // Check inventory_activities table
    console.log('\n📦 INVENTORY_ACTIVITIES TABLE:');
    const { data: activities, error: actError } = await supabaseAdmin
      .from('inventory_activities')
      .select('*')
      .limit(1);
    
    if (!actError) {
      console.log('✅ Inventory activities table exists');
      if (activities && activities.length > 0) {
        console.log('Columns:', Object.keys(activities[0]).join(', '));
      } else {
        console.log('No data in table');
      }
    } else {
      console.log('❌ Inventory activities table error:', actError.message);
    }
    
    // Check item_sales table
    console.log('\n📦 ITEM_SALES TABLE:');
    const { data: itemSales, error: salesError } = await supabaseAdmin
      .from('item_sales')
      .select('*')
      .limit(1);
    
    if (!salesError) {
      console.log('✅ Item sales table exists');
      if (itemSales && itemSales.length > 0) {
        console.log('Columns:', Object.keys(itemSales[0]).join(', '));
      } else {
        console.log('No data in table');
      }
    } else {
      console.log('❌ Item sales table error:', salesError.message);
    }

    console.log('\n✅ Schema check complete!');
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkInventorySchema();
