import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addCustomerIdColumn() {
  console.log('Adding customer_id column to order_items table...\n');

  // Check current columns
  const { data: columns, error: colError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .limit(1);

  if (colError) {
    console.error('Error checking order_items:', colError);
  } else {
    console.log('Current order_items columns:', Object.keys(columns[0] || {}));
  }

  // Use RPC to run raw SQL
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);'
  });

  if (error) {
    console.log('RPC method not available, trying alternative approach...');
    console.log('Note: You may need to add the column via Supabase Dashboard SQL Editor:');
    console.log('  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);');
  }
}

addCustomerIdColumn().catch(console.error);
