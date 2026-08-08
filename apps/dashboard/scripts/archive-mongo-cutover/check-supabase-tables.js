#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkOrderTables() {
  try {
    console.log('🔍 Checking order-related tables in Supabase...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('❌ Missing Supabase credentials');
      console.log('URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey);
      return;
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check orders table
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .limit(1);
    
    if (!ordersError) {
      console.log('✅ Orders table exists');
    } else {
      console.log('❌ Orders table not found:', ordersError.message);
    }
    
    // Check sales table
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('*')
      .limit(1);
    
    if (!salesError) {
      console.log('✅ Sales table exists');
    } else {
      console.log('❌ Sales table not found:', salesError.message);
    }
    
    // Check stores table  
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .limit(1);
    
    if (!storesError) {
      console.log('✅ Stores table exists');
    } else {
      console.log('❌ Stores table not found:', storesError.message);
    }
    
    console.log('\n📝 Next: Run migration scripts if tables don\'t exist');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOrderTables();