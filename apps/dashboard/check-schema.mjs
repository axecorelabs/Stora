import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data: inv } = await supabase.from('inventory').select('*').limit(1);
  console.log('Inventory:', inv && inv.length > 0 ? Object.keys(inv[0]) : 'No data');
  
  const { data: batches } = await supabase.from('inventory_batches').select('*').limit(1);
  console.log('Batches:', batches && batches.length > 0 ? Object.keys(batches[0]) : 'No data');
  
  const { data: activities } = await supabase.from('inventory_activities').select('*').limit(1);
  console.log('Activities:', activities && activities.length > 0 ? Object.keys(activities[0]) : 'No data');
  
  const { data: sales } = await supabase.from('item_sales').select('*').limit(1);
  console.log('ItemSales:', sales && sales.length > 0 ? Object.keys(sales[0]) : 'No data');
}
checkSchema();
