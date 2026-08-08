import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrderItemsCustomerIds() {
  console.log('Starting order_items customer_id fix...\n');

  // Get all orders with customer_id
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_id')
    .not('customer_id', 'is', null);

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return;
  }

  console.log(`Orders with customer_id: ${orders.length}`);

  let updated = 0;
  let failed = 0;

  for (const order of orders) {
    const { error: updateError } = await supabaseAdmin
      .from('order_items')
      .update({ customer_id: order.customer_id })
      .eq('order_id', order.id);

    if (updateError) {
      console.error(`Failed to update items for order ${order.order_number}:`, updateError.message);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Updated order_items for: ${updated} orders`);
  console.log(`Failed: ${failed} orders`);

  // Verify - count items with customer_id
  const { data: itemsWithCustomer, error: verifyError } = await supabaseAdmin
    .from('order_items')
    .select('id')
    .not('customer_id', 'is', null);

  if (!verifyError) {
    console.log(`\nOrder items with customer_id: ${itemsWithCustomer.length}`);
  }

  // Show sample
  const { data: sampleItems } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id, customer_id, product_name')
    .not('customer_id', 'is', null)
    .limit(5);

  if (sampleItems && sampleItems.length > 0) {
    console.log('\nSample order_items with customer_id:');
    sampleItems.forEach(item => {
      console.log(`  ${item.product_name}: customer_id = ${item.customer_id}`);
    });
  }
}

fixOrderItemsCustomerIds().catch(console.error);
